export interface JSONRPCRequest {
  jsonrpc: '2.0' | string;
  method: string;
  id: number;
  auth?: string | null;
  params?: JSONRPCRequestParams;
}

export interface JSONRPCResponse<T> {
  jsonrpc: '2.0' | string;
  id: number;
  result?: T;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code?: number;
  message?: string;
  data?: string;
}

export type JSONRPCRequestParams = {[key: string]: any};

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'CONNECT' | 'OPTIONS' | 'TRACE';

export type GFRequestOptions = {[key: string]: any};

export interface ZabbixRequestResponse {
  data?: JSONRPCResponse<any>;
}

export type ZabbixAPIResponse<T> = Promise<T>;

export type APILoginResponse = string;

export interface ZBXScript {
  scriptid: string;
  name?: string;
  command?: string;
  host_access?: string;
  usrgrpid?: string;
  groupid?: string;
  description?: string;
  confirmation?: string;
  type?: string;
  execute_on?: string;
}

export interface APIExecuteScriptResponse {
  response: 'success' | 'failed';
  value?: string;
}
