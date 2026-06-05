export interface AtlasComponentInfo {
  id: string;
  name: string;
  family: string;
  description?: string;
  version?: string;
}

export interface ComponentAtlasState {
  catalogStatus: 'empty' | 'scanning' | 'ready' | 'error';
  totalComponents: number;
  families: string[];
  components: AtlasComponentInfo[];
  searchQuery: string;
  selectedFamily: string | null;
}

export interface AtlasComponentSummary {
  name: string;
  family: string;
  description?: string;
}