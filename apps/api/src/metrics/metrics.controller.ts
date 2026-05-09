import type { MetricsService, MetricsSnapshot } from "./metrics.service.js";

export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  async get(): Promise<MetricsSnapshot> {
    return await this.metricsService.getSnapshot();
  }
}
