export interface CfoArtifact {
  skill: string;
  artifactKind: string;
  verdict: string;
  modelId: string;
  createdAt: string;
  body: any;
}

export interface CfoDeal {
  id: string;
  title: string;
  sponsor: string;
  decisionType: string;
  amount: number;
  stage: string;
  status: string;
  artifacts: CfoArtifact[];
}

export interface CfoDealset {
  generatedAt: string;
  source: string;
  tenant: string;
  harshVerdictRate: number;
  deals: CfoDeal[];
}
