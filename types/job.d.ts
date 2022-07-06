export interface mappedJob {
  id: number;
  startAt: string;
  endAt: string;
  scanUrl: string;
  type: string;
  status: string;
  s3HTMLUrl: string;
  s3JSONUrl: string;
  s3CleanJSONUrl: string;
  jsonResult: Record<string, unknown>;
  preserve: boolean;
  preserve_reason: string;
}

export interface updatePreserveBody {
  value: boolean;
  reason: string;
}
