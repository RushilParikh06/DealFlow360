// B2 OWNED. The single gateway to every LLM call in the intelligence module.
//
// Rules:
//  1. Never throws to callers — always returns null on failure.
//  2. Primary: Gemini 1.5 Flash. Fallback: Groq llama-3.1-8b-instant on 429 / network error.
//  3. Every call requests JSON output via responseMimeType / response_format.
//  4. AI_ENABLED=false short-circuits immediately (useful for tests and CI).

import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export interface AiCallOptions {
  /** Short label for logs only, e.g. "upsell-reasoning". */
  feature: string;
  systemPrompt: string;
  userPrompt: string;
  /** Max tokens to generate. Keep small for latency. Default 512. */
  maxTokens?: number;
}

@Injectable()
export class AIProviderService {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly enabled: boolean;
  private readonly gemini: GoogleGenerativeAI | null;
  private readonly groq: Groq | null;

  constructor() {
    this.enabled = process.env.AI_ENABLED !== 'false';
    this.gemini = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
    this.groq = process.env.GROQ_API_KEY
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;

    if (this.enabled) {
      if (!this.gemini && !this.groq) {
        this.logger.warn('AI_ENABLED=true but neither GEMINI_API_KEY nor GROQ_API_KEY is set — every AI call will return null.');
      } else {
        this.logger.log(`AI ready. Primary: ${this.gemini ? 'gemini' : 'none'}, Fallback: ${this.groq ? 'groq' : 'none'}`);
      }
    }
  }

  /**
   * Call the LLM and return the raw text response (expected JSON).
   * Returns null if AI is disabled, both providers fail, or keys are missing.
   */
  async call(options: AiCallOptions): Promise<string | null> {
    if (!this.enabled) return null;

    const { feature, systemPrompt, userPrompt, maxTokens = 512 } = options;
    const start = Date.now();

    // ── Primary: Gemini Flash ─────────────────────────────────────────────────
    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemPrompt,
          generationConfig: {
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
        });
        const result = await model.generateContent(userPrompt);
        const text = result.response.text();
        this.logger.log(
          JSON.stringify({ event: 'ai_call', feature, provider: 'gemini', latencyMs: Date.now() - start, success: true }),
        );
        return text;
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        this.logger.warn(`[AI:${feature}] gemini failed (HTTP ${status ?? 'network'}) — trying groq`);
        // A 4xx that is NOT rate-limit means the prompt itself is bad — no point retrying.
        if (status && status !== 429 && status < 500) return null;
      }
    }

    // ── Fallback: Groq ────────────────────────────────────────────────────────
    if (this.groq) {
      try {
        const completion = await this.groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        const text = completion.choices[0]?.message?.content ?? null;
        this.logger.log(
          JSON.stringify({ event: 'ai_call', feature, provider: 'groq', latencyMs: Date.now() - start, success: true }),
        );
        return text;
      } catch (err: unknown) {
        this.logger.error(`[AI:${feature}] groq also failed`, err);
      }
    }

    this.logger.warn(`[AI:${feature}] both providers unavailable — returning null`);
    return null;
  }

  /**
   * Convenience wrapper: call the LLM and parse the JSON into T.
   * Returns null on any parse error so callers never need try/catch.
   */
  async callJson<T>(options: AiCallOptions): Promise<T | null> {
    const raw = await this.call(options);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`[AI:${options.feature}] JSON parse failed. Raw (first 200 chars): ${raw.slice(0, 200)}`);
      return null;
    }
  }
}
