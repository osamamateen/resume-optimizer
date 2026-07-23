"use client";

import { useState } from "react";
import type { ResumeData } from "@/types/resume.types";
import { ListEditor } from "@/components/resume/ListEditor";
import { TagListEditor } from "@/components/resume/TagListEditor";

type ExperienceEntry = ResumeData["experience"][number];
type EducationEntry = ResumeData["education"][number];
type ProjectEntry = NonNullable<ResumeData["projects"]>[number];
type CustomSectionEntry = NonNullable<ResumeData["customSections"]>[number];

interface ResumeEditorProps {
  initialData: ResumeData;
  onSave: (data: ResumeData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

const inputClass =
  "w-full min-h-[36px] px-3 py-2 text-[14px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none";

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-[12px] mb-[5px] text-text-secondary">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

export function ResumeEditor({ initialData, onSave, onCancel, saving, error }: ResumeEditorProps) {
  const [data, setData] = useState<ResumeData>(initialData);

  function updateContact(patch: Partial<ResumeData["contact"]>) {
    setData((d) => ({ ...d, contact: { ...d.contact, ...patch } }));
  }

  const skills = data.skills ?? { languages: [], frameworks: [], tools: [], other: [] };
  function updateSkills(patch: Partial<NonNullable<ResumeData["skills"]>>) {
    setData((d) => ({ ...d, skills: { ...skills, ...patch } }));
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Contact</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name" value={data.contact.name} onChange={(v) => updateContact({ name: v })} />
          <Field label="Email" value={data.contact.email} onChange={(v) => updateContact({ email: v })} />
          <Field label="Phone" value={data.contact.phone} onChange={(v) => updateContact({ phone: v })} />
          <Field label="Location" value={data.contact.location} onChange={(v) => updateContact({ location: v })} />
          <Field label="LinkedIn" value={data.contact.linkedin ?? ""} onChange={(v) => updateContact({ linkedin: v })} />
          <Field label="GitHub" value={data.contact.github ?? ""} onChange={(v) => updateContact({ github: v })} />
          <Field label="Website" value={data.contact.website ?? ""} onChange={(v) => updateContact({ website: v })} />
        </div>
      </div>

      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Summary</div>
        <textarea
          value={data.summary ?? ""}
          onChange={(e) => setData((d) => ({ ...d, summary: e.target.value }))}
          rows={4}
          className="w-full px-[14px] py-3 text-text-primary bg-surface border border-border-hairline rounded-lg outline-none resize-y text-[14px] leading-[1.55]"
        />
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Experience</div>
        <ListEditor<ExperienceEntry>
          items={data.experience}
          onChange={(items) => setData((d) => ({ ...d, experience: items }))}
          createItem={() => ({ title: "", company: "", location: "", startDate: "", endDate: "", bullets: [] })}
          addLabel="Add experience"
          emptyLabel="No experience entries yet."
          renderItem={(item, update) => (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
                <Field label="Company" value={item.company} onChange={(v) => update({ company: v })} />
                <Field label="Location" value={item.location ?? ""} onChange={(v) => update({ location: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date" value={item.startDate} onChange={(v) => update({ startDate: v })} />
                  <Field label="End date" value={item.endDate} onChange={(v) => update({ endDate: v })} />
                </div>
              </div>
              <TagListEditor
                label="Bullets"
                values={item.bullets}
                onChange={(bullets) => update({ bullets })}
                placeholder="Add a bullet and press Enter"
              />
            </div>
          )}
        />
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Education</div>
        <ListEditor<EducationEntry>
          items={data.education}
          onChange={(items) => setData((d) => ({ ...d, education: items }))}
          createItem={() => ({ institution: "", degree: "", field: "", graduationDate: "" })}
          addLabel="Add education"
          emptyLabel="No education entries yet."
          renderItem={(item, update) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Institution" value={item.institution} onChange={(v) => update({ institution: v })} />
              <Field label="Degree" value={item.degree} onChange={(v) => update({ degree: v })} />
              <Field label="Field" value={item.field ?? ""} onChange={(v) => update({ field: v })} />
              <Field label="Graduation date" value={item.graduationDate} onChange={(v) => update({ graduationDate: v })} />
            </div>
          )}
        />
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Projects</div>
        <ListEditor<ProjectEntry>
          items={data.projects ?? []}
          onChange={(items) => setData((d) => ({ ...d, projects: items }))}
          createItem={() => ({ name: "", description: "", technologies: [], bullets: [] })}
          addLabel="Add project"
          emptyLabel="No projects yet."
          renderItem={(item, update) => (
            <div className="flex flex-col gap-3">
              <Field label="Name" value={item.name} onChange={(v) => update({ name: v })} />
              <Field label="Description" value={item.description ?? ""} onChange={(v) => update({ description: v })} />
              <TagListEditor
                label="Technologies"
                values={item.technologies}
                onChange={(technologies) => update({ technologies })}
                placeholder="Add a technology and press Enter"
              />
              <TagListEditor
                label="Bullets"
                values={item.bullets}
                onChange={(bullets) => update({ bullets })}
                placeholder="Add a bullet and press Enter"
              />
            </div>
          )}
        />
      </div>

      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Skills</div>
        <div className="flex flex-col gap-4">
          <TagListEditor
            label="Languages"
            values={skills.languages}
            onChange={(v) => updateSkills({ languages: v })}
            placeholder="Add a language and press Enter"
          />
          <TagListEditor
            label="Frameworks"
            values={skills.frameworks}
            onChange={(v) => updateSkills({ frameworks: v })}
            placeholder="Add a framework and press Enter"
          />
          <TagListEditor
            label="Tools"
            values={skills.tools}
            onChange={(v) => updateSkills({ tools: v })}
            placeholder="Add a tool and press Enter"
          />
          <TagListEditor
            label="Other"
            values={skills.other}
            onChange={(v) => updateSkills({ other: v })}
            placeholder="Add a skill and press Enter"
          />
        </div>
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Custom sections</div>
        <ListEditor<CustomSectionEntry>
          items={data.customSections ?? []}
          onChange={(items) => setData((d) => ({ ...d, customSections: items }))}
          createItem={() => ({ label: "", content: "" })}
          addLabel="Add custom section"
          emptyLabel="No custom sections yet."
          renderItem={(item, update) => (
            <div className="flex flex-col gap-3">
              <Field label="Label" value={item.label} onChange={(v) => update({ label: v })} />
              <div>
                <label className="block text-[12px] mb-[5px] text-text-secondary">Content</label>
                <textarea
                  value={item.content}
                  onChange={(e) => update({ content: e.target.value })}
                  rows={3}
                  className="w-full px-[14px] py-3 text-text-primary bg-surface border border-border-hairline rounded-lg outline-none resize-y text-[14px] leading-[1.55]"
                />
              </div>
            </div>
          )}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-[9px]">
        <button
          type="button"
          onClick={() => onSave(data)}
          disabled={saving}
          className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-accent rounded-lg bg-transparent text-accent text-[15px] font-medium disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-[11px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
