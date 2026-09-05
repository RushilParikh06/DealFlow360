import { Controller } from '@nestjs/common';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';

@Controller('opportunities')
export class OpportunitiesController extends DealsController {
  constructor(dealsService: DealsService) {
    super(dealsService);
  }
}
