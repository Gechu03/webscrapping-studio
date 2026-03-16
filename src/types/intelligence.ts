export interface StyleDefinition {
  name: string;
  slug: string;
  description: string;
  cssProperties: Record<string, string>;
  sectors: string[];
  typography: {
    heading: string;
    body: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  borderRadius: string;
  animations: string[];
}

export interface ComponentPattern {
  name: string;
  type: string;
  rating: 1 | 2 | 3; // ★ ★★ ★★★
  sectors: string[];
  description: string;
  variants: string[];
  cssPreview?: string;
  antiPatterns?: string[];
}

export interface TypographyPairing {
  heading: string;
  body: string;
  style: string;
  sectors: string[];
  googleFontsUrl?: string;
}

export interface SectorInfo {
  name: string;
  subCategories: {
    name: string;
    sites: string[];
    status: 'SUFFICIENT' | 'INSUFFICIENT';
  }[];
}
