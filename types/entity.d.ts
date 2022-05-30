export interface createBody {
  external_id: string;
  url: string;
  enable: boolean;
  type: string;
}

export interface updateBody {
  url: string;
  enable: boolean;
}
