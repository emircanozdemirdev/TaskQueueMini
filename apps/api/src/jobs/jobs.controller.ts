import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { CreateJobResponse } from "@task-queue-mini/shared-types";

import { HttpError } from "../http/errors.js";
import { CreateJobDto } from "./dto/create-job.dto.js";
import type { JobsService } from "./jobs.service.js";

export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  async create(input: unknown): Promise<CreateJobResponse> {
    const dto = plainToInstance(CreateJobDto, input);
    const validationErrors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });

    if (validationErrors.length > 0) {
      const first = validationErrors[0];
      const message =
        first?.constraints !== undefined
          ? String(Object.values(first.constraints)[0])
          : "Invalid create job payload";
      throw new HttpError(message, 400, "VALIDATION_ERROR");
    }

    return await this.jobsService.enqueue(dto);
  }
}
