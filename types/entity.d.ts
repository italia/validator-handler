export interface createBody {
  external_id: string;
  url: string;
  enable: boolean;
  type: string;
  subtype: string;
}

export interface updateBody {
  url: string;
  enable: boolean;
  asseverationJobId: string;
  subtype: string;
}
