export type ComponentMastery = {
  componentName: string;
  whatItDoes: string;
  whenToUse: string[];
  whenNotToUse: string[];
  requiredParameters: string[];
  commonParameters: string[];
  commonErrors: Array<{
    symptom: string;
    cause: string;
    fix: string;
  }>;
  bestPractices: string[];
  examplePipelines: Array<{
    title: string;
    flow: string[];
    explanation: string;
  }>;
};
