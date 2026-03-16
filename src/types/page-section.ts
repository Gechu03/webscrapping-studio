export interface PageSection {
  id: string;
  name: string;
  type: string;           // file name key: components/{type}.html
  description: string;
  required: boolean;      // required vs optional for this sector
  position: number;       // order in page (1-based)
  sectorHints?: string;   // sector-specific guidance for Claude
}
