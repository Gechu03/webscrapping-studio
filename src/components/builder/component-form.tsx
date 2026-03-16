'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ComponentPattern } from '@/types/intelligence';

export interface ComponentFormData {
  heading: string;
  subheading: string;
  body: string;
  ctaText: string;
  items: string;
  additionalRequirements: string;
}

interface ComponentFormProps {
  pattern: ComponentPattern | null;
  data: ComponentFormData;
  onChange: (data: ComponentFormData) => void;
}

export function ComponentForm({ pattern, data, onChange }: ComponentFormProps) {
  const update = (field: keyof ComponentFormData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      {pattern && (
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
          <p className="font-medium">{pattern.name}</p>
          <p className="text-muted-foreground mt-0.5">{pattern.description}</p>
        </div>
      )}

      <div>
        <Label htmlFor="heading">Heading</Label>
        <Input
          id="heading"
          placeholder="Your compelling headline"
          value={data.heading}
          onChange={(e) => update('heading', e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="subheading">Subheading</Label>
        <Input
          id="subheading"
          placeholder="Supporting text"
          value={data.subheading}
          onChange={(e) => update('subheading', e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="body">Body Text</Label>
        <Textarea
          id="body"
          placeholder="Main content text..."
          value={data.body}
          onChange={(e) => update('body', e.target.value)}
          className="mt-1"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="cta">CTA Text</Label>
        <Input
          id="cta"
          placeholder="Get Started"
          value={data.ctaText}
          onChange={(e) => update('ctaText', e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="items">Items (one per line)</Label>
        <Textarea
          id="items"
          placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
          value={data.items}
          onChange={(e) => update('items', e.target.value)}
          className="mt-1"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="additional">Additional Requirements</Label>
        <Textarea
          id="additional"
          placeholder="Any specific requirements, animations, layout preferences..."
          value={data.additionalRequirements}
          onChange={(e) => update('additionalRequirements', e.target.value)}
          className="mt-1"
          rows={3}
        />
      </div>
    </div>
  );
}
