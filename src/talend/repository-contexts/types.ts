export type RepositoryContextParameter = {
  name: string;
  type?: string;
  value?: string;
  prompt?: string;
};

export type RepositoryContextContext = {
  contextName: string;
  parameters: RepositoryContextParameter[];
};

export type RepositoryContext = {
  name: string;
  version: string;
  purpose?: string;
  description?: string;
  itemPath: string;
  propertiesPath: string;
  contexts: RepositoryContextContext[];
};
