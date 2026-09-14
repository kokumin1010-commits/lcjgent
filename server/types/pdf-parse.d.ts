declare module "pdf-parse" {
  export type PdfParseResult = {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  };

  export type PdfParseOptions = Record<string, unknown>;

  const pdfParse: (buffer: Buffer, options?: PdfParseOptions) => Promise<PdfParseResult>;
  export default pdfParse;
}
