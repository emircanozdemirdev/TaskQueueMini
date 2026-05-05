import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { CreateJobDto } from "./dto/create-job.dto.js";

export class JobsController {
  create(input: unknown): { accepted: true } {
    const dto = plainToInstance(CreateJobDto, input);
    const validationErrors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });

    if (validationErrors.length > 0) {
      throw new Error("Invalid create job payload");
    }

    // Enqueue flow will be implemented in step 5.2.
    return { accepted: true };
  }
}
