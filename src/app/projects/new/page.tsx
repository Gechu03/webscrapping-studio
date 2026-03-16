'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Globe, Palette, Type, Pipette, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { OutputFormat, ProjectConfig } from '@/types/project';
import type { StyleDefinition, TypographyPairing } from '@/types/intelligence';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Project Info', icon: Globe },
  { label: 'Output Format', icon: () => <span className="text-sm font-mono">{'{}'}</span> },
  { label: 'Style', icon: Palette },
  { label: 'Typography', icon: Type },
  { label: 'Colors', icon: Pipette },
];

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'react', label: 'React', description: 'TSX components with hooks and TypeScript' },
  { value: 'vue', label: 'Vue', description: 'Vue 3 SFCs with Composition API' },
  { value: 'vanilla', label: 'Vanilla HTML', description: 'Standalone HTML/CSS/JS files' },
  { value: 'designer', label: 'Designer Mode', description: 'Specs + reference HTML for developer handoff' },
];

const PRESET_SECTORS = [
  'Real Estate', 'Travel & Hospitality', 'SaaS / B2B', 'E-Commerce / DTC',
  'Fintech', 'Health & Wellness', 'Fashion & Luxury', 'Education / EdTech',
  'Automotive', 'Food & Beverage', 'Professional Services', 'Tech & Consumer',
  'Media & Entertainment', 'Architecture & Design', 'Financial Services',
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [styles, setStyles] = useState<StyleDefinition[]>([]);
  const [typoPairings, setTypoPairings] = useState<TypographyPairing[]>([]);
  const [customSector, setCustomSector] = useState('');
  const [competitorInput, setCompetitorInput] = useState('');
  const competitorRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<Partial<ProjectConfig>>({
    name: '',
    url: '',
    sector: '',
    outputFormat: 'vanilla',
    style: '',
    typography: { heading: 'Inter', body: 'Inter' },
    colors: { primary: '#000000', secondary: '#666666', accent: '#3b82f6', background: '#ffffff' },
    competitors: [],
  });

  // Load intelligence data when reaching style/typography steps
  const loadIntelligence = async () => {
    if (styles.length > 0) return;
    try {
      const [stylesRes, typoRes] = await Promise.all([
        fetch('/api/intelligence/styles'),
        fetch('/api/intelligence/typography'),
      ]);
      if (stylesRes.ok) setStyles(await stylesRes.json());
      if (typoRes.ok) setTypoPairings(await typoRes.json());
    } catch {
      // Use defaults
    }
  };

  const handleNext = async () => {
    if (step === 1) await loadIntelligence();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      await handleCreate();
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create project');
      }

      const project = await res.json();
      toast.success('Project created successfully');
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!config.name && !!config.sector;
      case 1: return !!config.outputFormat;
      case 2: return !!config.style;
      case 3: return !!config.typography?.heading;
      case 4: return !!config.colors?.primary;
      default: return true;
    }
  };

  // Competitor tag management
  const addCompetitor = () => {
    const url = competitorInput.trim();
    if (!url) return;
    setConfig((prev) => {
      if (prev.competitors?.includes(url)) return prev;
      return { ...prev, competitors: [...(prev.competitors || []), url] };
    });
    setCompetitorInput('');
    competitorRef.current?.focus();
  };

  const removeCompetitor = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      competitors: (prev.competitors || []).filter((_, i) => i !== index),
    }));
  };

  const handleCompetitorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCompetitor();
    }
  };

  // Sector selection
  const selectSector = (sector: string) => {
    setConfig({ ...config, sector });
    setCustomSector('');
  };

  const applyCustomSector = () => {
    if (customSector.trim()) {
      setConfig({ ...config, sector: customSector.trim() });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors',
                  i === step
                    ? 'bg-primary text-primary-foreground'
                    : i < step
                    ? 'bg-primary/10 text-primary cursor-pointer'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('w-8 h-px', i < step ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {step === 0 && (
            <>
              <div>
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  placeholder="My Awesome Website"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="url">Reference URL (optional)</Label>
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide a URL to analyze and extract design patterns from
                </p>
              </div>

              {/* Sector selection with custom input */}
              <div>
                <Label>Sector *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                  {PRESET_SECTORS.map((sector) => (
                    <button
                      key={sector}
                      onClick={() => selectSector(sector)}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                        config.sector === sector
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <Label htmlFor="custom-sector" className="text-xs text-muted-foreground">
                    Or type a custom sector
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="custom-sector"
                      placeholder="e.g. Healthcare, Gaming, Non-Profit..."
                      value={customSector}
                      onChange={(e) => setCustomSector(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyCustomSector();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applyCustomSector}
                      disabled={!customSector.trim()}
                    >
                      Set
                    </Button>
                  </div>
                  {config.sector && !PRESET_SECTORS.includes(config.sector) && (
                    <p className="text-xs text-primary mt-1">
                      Custom sector: <span className="font-medium">{config.sector}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Competitor URLs as tags */}
              <div>
                <Label>Competitor URLs</Label>
                <div className="mt-1.5 space-y-2">
                  {/* Tags */}
                  {config.competitors && config.competitors.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {config.competitors.map((url, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1 text-xs"
                        >
                          <span className="max-w-[200px] truncate">{url}</span>
                          <button
                            onClick={() => removeCompetitor(i)}
                            className="ml-1 hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* Input */}
                  <div className="flex gap-2">
                    <Input
                      ref={competitorRef}
                      placeholder="https://competitor.com — press Enter or click Add"
                      value={competitorInput}
                      onChange={(e) => setCompetitorInput(e.target.value)}
                      onKeyDown={handleCompetitorKeyDown}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addCompetitor}
                      disabled={!competitorInput.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type a URL and press Enter to add. Add multiple competitors one at a time.
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {OUTPUT_FORMATS.map((format) => (
                <button
                  key={format.value}
                  onClick={() =>
                    setConfig({ ...config, outputFormat: format.value })
                  }
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    config.outputFormat === format.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <div className="font-medium">{format.label}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format.description}
                  </p>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(styles.length > 0 ? styles : getDefaultStyleCards()).map((style) => (
                  <button
                    key={style.slug}
                    onClick={() =>
                      setConfig({
                        ...config,
                        style: style.name,
                        colors: style.colors,
                        typography: style.typography,
                      })
                    }
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all',
                      config.style === style.name
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/30'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: style.colors.primary }}
                      />
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: style.colors.secondary }}
                      />
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: style.colors.accent }}
                      />
                    </div>
                    <div className="font-medium">{style.name}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {style.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {style.sectors.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}

                {/* Custom style option */}
                <button
                  onClick={() =>
                    setConfig({
                      ...config,
                      style: 'Custom',
                    })
                  }
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all border-dashed',
                    config.style === 'Custom'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center">
                      <Plus className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="font-medium">Custom Style</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Define your own color palette and typography
                  </p>
                </button>
              </div>

              {/* Custom style color inputs — shown when Custom is selected */}
              {config.style === 'Custom' && (
                <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
                  <p className="text-sm font-medium">Custom Color Palette</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="custom-primary" className="text-xs">Primary</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          id="custom-primary"
                          value={config.colors?.primary || '#000000'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, primary: e.target.value },
                            })
                          }
                          className="w-10 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={config.colors?.primary || '#000000'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, primary: e.target.value },
                            })
                          }
                          className="w-28 font-mono text-xs h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="custom-secondary" className="text-xs">Secondary</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          id="custom-secondary"
                          value={config.colors?.secondary || '#666666'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, secondary: e.target.value },
                            })
                          }
                          className="w-10 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={config.colors?.secondary || '#666666'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, secondary: e.target.value },
                            })
                          }
                          className="w-28 font-mono text-xs h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="custom-accent" className="text-xs">Accent</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          id="custom-accent"
                          value={config.colors?.accent || '#3b82f6'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, accent: e.target.value },
                            })
                          }
                          className="w-10 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={config.colors?.accent || '#3b82f6'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, accent: e.target.value },
                            })
                          }
                          className="w-28 font-mono text-xs h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="custom-bg" className="text-xs">Background</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          id="custom-bg"
                          value={config.colors?.background || '#ffffff'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, background: e.target.value },
                            })
                          }
                          className="w-10 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={config.colors?.background || '#ffffff'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              colors: { ...config.colors!, background: e.target.value },
                            })
                          }
                          className="w-28 font-mono text-xs h-8"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Preview swatch */}
                  <div className="flex gap-2 pt-2">
                    <div className="w-12 h-12 rounded-lg border" style={{ backgroundColor: config.colors?.primary }} />
                    <div className="w-12 h-12 rounded-lg border" style={{ backgroundColor: config.colors?.secondary }} />
                    <div className="w-12 h-12 rounded-lg border" style={{ backgroundColor: config.colors?.accent }} />
                    <div className="w-12 h-12 rounded-lg border" style={{ backgroundColor: config.colors?.background }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {(typoPairings.length > 0 ? typoPairings : getDefaultTypoPairings()).map((pair) => (
                <button
                  key={`${pair.heading}-${pair.body}`}
                  onClick={() =>
                    setConfig({
                      ...config,
                      typography: { heading: pair.heading, body: pair.body },
                    })
                  }
                  className={cn(
                    'w-full p-4 rounded-xl border text-left transition-all',
                    config.typography?.heading === pair.heading &&
                      config.typography?.body === pair.body
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{pair.heading}</p>
                      <p className="text-sm text-muted-foreground">
                        {pair.body} (body)
                      </p>
                    </div>
                    <Badge variant="outline">{pair.style}</Badge>
                  </div>
                </button>
              ))}

              {/* Custom typography input */}
              <div className="p-4 rounded-xl border border-dashed space-y-3">
                <p className="text-sm font-medium">Custom Typography</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom-heading-font" className="text-xs">Heading Font</Label>
                    <Input
                      id="custom-heading-font"
                      placeholder="e.g. Poppins"
                      value={config.typography?.heading || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          typography: { ...config.typography!, heading: e.target.value },
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-body-font" className="text-xs">Body Font</Label>
                    <Input
                      id="custom-body-font"
                      placeholder="e.g. Open Sans"
                      value={config.typography?.body || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          typography: { ...config.typography!, body: e.target.value },
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="primary">Primary Color</Label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="color"
                    id="primary"
                    value={config.colors?.primary || '#000000'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, primary: e.target.value },
                      })
                    }
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={config.colors?.primary || '#000000'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, primary: e.target.value },
                      })
                    }
                    className="w-32 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secondary">Secondary Color</Label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="color"
                    id="secondary"
                    value={config.colors?.secondary || '#666666'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, secondary: e.target.value },
                      })
                    }
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={config.colors?.secondary || '#666666'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, secondary: e.target.value },
                      })
                    }
                    className="w-32 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="accent">Accent Color</Label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="color"
                    id="accent"
                    value={config.colors?.accent || config.colors?.primary || '#000000'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, accent: e.target.value },
                      })
                    }
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={config.colors?.accent || config.colors?.primary || '#000000'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, accent: e.target.value },
                      })
                    }
                    className="w-32 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="background">Background Color</Label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="color"
                    id="background"
                    value={config.colors?.background || '#ffffff'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, background: e.target.value },
                      })
                    }
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={config.colors?.background || '#ffffff'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        colors: { ...config.colors!, background: e.target.value },
                      })
                    }
                    className="w-32 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Preview swatch */}
              <div className="p-4 rounded-xl border">
                <p className="text-sm font-medium mb-3">Preview</p>
                <div className="flex gap-2">
                  <div className="text-center">
                    <div
                      className="w-16 h-16 rounded-lg border"
                      style={{ backgroundColor: config.colors?.primary }}
                    />
                    <span className="text-[10px] text-muted-foreground mt-1">Primary</span>
                  </div>
                  <div className="text-center">
                    <div
                      className="w-16 h-16 rounded-lg border"
                      style={{ backgroundColor: config.colors?.secondary }}
                    />
                    <span className="text-[10px] text-muted-foreground mt-1">Secondary</span>
                  </div>
                  <div className="text-center">
                    <div
                      className="w-16 h-16 rounded-lg border"
                      style={{ backgroundColor: config.colors?.accent }}
                    />
                    <span className="text-[10px] text-muted-foreground mt-1">Accent</span>
                  </div>
                  <div className="text-center">
                    <div
                      className="w-16 h-16 rounded-lg border"
                      style={{ backgroundColor: config.colors?.background }}
                    />
                    <span className="text-[10px] text-muted-foreground mt-1">Background</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (step > 0 ? setStep(step - 1) : router.push('/'))}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step > 0 ? 'Back' : 'Cancel'}
        </Button>
        <Button onClick={handleNext} disabled={!canProceed() || loading}>
          {step === STEPS.length - 1 ? (
            loading ? (
              'Creating...'
            ) : (
              <>
                Create Project
                <Check className="w-4 h-4 ml-2" />
              </>
            )
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function getDefaultStyleCards() {
  return [
    { name: 'Warm Editorial', slug: 'warm-editorial', description: 'Warm, inviting with editorial typography', sectors: ['Real Estate', 'Travel'], typography: { heading: 'Cormorant Garamond', body: 'Montserrat' }, colors: { primary: '#e58747', secondary: '#2c3e50', accent: '#d4a373', background: '#fefae0', text: '#1a1a1a' } },
    { name: 'Tech Minimal', slug: 'tech-minimal', description: 'Clean, modern, developer-friendly', sectors: ['SaaS', 'Fintech'], typography: { heading: 'Inter', body: 'Inter' }, colors: { primary: '#000000', secondary: '#6b7280', accent: '#3b82f6', background: '#ffffff', text: '#111827' } },
    { name: 'Luxury Dark', slug: 'luxury-dark', description: 'High-contrast dark with gold accents', sectors: ['Fashion', 'Automotive'], typography: { heading: 'Playfair Display', body: 'Lato' }, colors: { primary: '#c9a96e', secondary: '#1a1a1a', accent: '#d4af37', background: '#0a0a0a', text: '#f5f5f5' } },
    { name: 'Bold Vibrant', slug: 'bold-vibrant', description: 'Energetic with saturated colors', sectors: ['E-Commerce', 'DTC'], typography: { heading: 'Space Grotesk', body: 'DM Sans' }, colors: { primary: '#FF5722', secondary: '#1a1a2e', accent: '#FFD600', background: '#ffffff', text: '#1a1a2e' } },
    { name: 'Clean Corporate', slug: 'clean-corporate', description: 'Professional, trustworthy blue palette', sectors: ['Financial', 'Professional'], typography: { heading: 'Plus Jakarta Sans', body: 'Source Sans 3' }, colors: { primary: '#1e40af', secondary: '#334155', accent: '#0ea5e9', background: '#f8fafc', text: '#0f172a' } },
    { name: 'Organic Natural', slug: 'organic-natural', description: 'Soft organic shapes with earth tones', sectors: ['Health', 'Food'], typography: { heading: 'Fraunces', body: 'Outfit' }, colors: { primary: '#4a7c59', secondary: '#8b6f47', accent: '#a8c090', background: '#faf6f0', text: '#2d2d2d' } },
  ];
}

function getDefaultTypoPairings() {
  return [
    { heading: 'Cormorant Garamond', body: 'Montserrat', style: 'Warm Editorial', sectors: [] },
    { heading: 'Inter', body: 'Inter', style: 'Tech Minimal', sectors: [] },
    { heading: 'Playfair Display', body: 'Lato', style: 'Luxury Dark', sectors: [] },
    { heading: 'Space Grotesk', body: 'DM Sans', style: 'Bold Vibrant', sectors: [] },
    { heading: 'Plus Jakarta Sans', body: 'Source Sans 3', style: 'Clean Corporate', sectors: [] },
    { heading: 'Fraunces', body: 'Outfit', style: 'Organic Natural', sectors: [] },
    { heading: 'Poppins', body: 'Nunito', style: 'Friendly Modern', sectors: [] },
  ];
}
