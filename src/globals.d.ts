// tslint:disable:max-classes-per-file
declare class Blob {
  readonly size: number
  readonly type: string
}

declare class File extends Blob {
  readonly name: string
  constructor(blobs: Blob[], name: string)
}

declare class URL {
  static createObjectURL(blob: Blob): string
}

declare function btoa(str: string): string
