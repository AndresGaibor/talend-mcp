import type { Checklist, ChecklistItem, ValidateChecklistOptions } from "../domain/deliverable.types";

export class ValidateChecklistUseCase {
  async execute(options: ValidateChecklistOptions): Promise<Checklist> {
    const validatedItems = options.items.map((item) => {
      if (!item.required) {
        return { ...item, checked: true };
      }
      return item;
    });

    const allRequiredPassed = validatedItems
      .filter((item) => item.required)
      .every((item) => item.checked);

    return {
      id: options.checklistId,
      name: "Deliverable Checklist",
      items: validatedItems,
      passed: allRequiredPassed,
      validatedAt: new Date(),
    };
  }
}