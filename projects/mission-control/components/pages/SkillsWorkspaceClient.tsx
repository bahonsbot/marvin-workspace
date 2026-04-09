'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { floatingInsetStyle, floatingPanelStyle } from '@/components/shared/floating';
import { BackToTopButton } from '@/components/memory/BackToTopButton';
import type { SkillSummary, SkillsSummary } from '@/lib/types/contracts';

type ViewFilter = 'all' | 'active' | 'needs-attention';
type SourceFilter = 'all' | 'bundled' | 'workspace' | 'clawhub' | 'other';

type SkillsUiState = {
  hiddenSkills: string[];
  tagMap: Record<string, string[]>;
  updatedAt?: string;
};

type TagComposerProps = {
  availableTags: string[];
  existingTags?: string[];
  submitLabel: string;
  onSubmit: (tag: string) => void;
  onCancel: () => void;
};

const SOURCE_ORDER: Array<SkillSummary['source']> = ['bundled', 'workspace', 'clawhub', 'other'];
const HIDDEN_STORAGE_KEY = 'mission-control:skills:hidden';
const TAGS_STORAGE_KEY = 'mission-control:skills:tags';
const PREFERENCES_ENDPOINT = '/api/skills/preferences';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persistJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function formatTimestamp(at: string | null | undefined) {
  if (!at) return '—';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function statusBadge(skill: SkillSummary, hidden: boolean) {
  if (hidden) return { label: 'Hidden', bg: 'rgba(200, 195, 188, 0.18)', text: '#6e6a65' };
  if (skill.disabled) return { label: 'Disabled', bg: 'rgba(248, 113, 113, 0.16)', text: '#b44c4c' };
  if (skill.blockedByAllowlist) return { label: 'Blocked', bg: 'rgba(196, 130, 58, 0.14)', text: '#a36a2f' };
  if (!skill.eligible) return { label: 'Unavailable', bg: 'rgba(196, 130, 58, 0.14)', text: '#a36a2f' };
  if (skill.missingCount > 0) return { label: 'Missing setup', bg: 'rgba(196, 130, 58, 0.14)', text: '#a36a2f' };
  return { label: 'Active', bg: 'rgba(121, 166, 148, 0.16)', text: '#315f51' };
}

function sourceBadge(source: SkillSummary['source']) {
  if (source === 'bundled') return { label: 'Bundled', bg: 'rgba(121, 166, 148, 0.14)', text: '#315f51' };
  if (source === 'workspace') return { label: 'Workspace', bg: 'rgba(109, 145, 164, 0.14)', text: '#4a6d7b' };
  if (source === 'clawhub') return { label: 'ClawHub', bg: 'rgba(150, 123, 186, 0.14)', text: '#6d5790' };
  return { label: 'Other', bg: 'rgba(200, 195, 188, 0.18)', text: '#6e6a65' };
}

function matchesView(skill: SkillSummary, view: ViewFilter) {
  if (view === 'active') return skill.eligible && !skill.disabled && !skill.blockedByAllowlist;
  if (view === 'needs-attention') return skill.needsAttention;
  return true;
}

function matchesSource(skill: SkillSummary, source: SourceFilter) {
  return source === 'all' ? true : skill.source === source;
}

function cardStyle(hidden: boolean, attention: boolean) {
  return floatingPanelStyle({
    borderColor: hidden ? 'rgba(200, 195, 188, 0.34)' : attention ? 'rgba(196, 130, 58, 0.2)' : 'rgba(121, 166, 148, 0.18)',
    radius: 20,
    padding: 16,
    background: hidden
      ? 'linear-gradient(180deg, rgba(249, 247, 244, 0.88) 0%, rgba(242, 238, 233, 0.78) 100%)'
      : 'linear-gradient(180deg, rgba(255, 253, 251, 0.94) 0%, rgba(247, 241, 235, 0.84) 100%)',
  });
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`floating-pill${active ? ' floating-pill-active' : ''}`} style={{ cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function MissingList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--muted)' }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map((item) => (
          <span
            key={item}
            style={{
              padding: '5px 9px',
              borderRadius: 999,
              background: 'rgba(255, 248, 240, 0.92)',
              border: '1px solid rgba(196, 130, 58, 0.18)',
              color: '#8a6338',
              fontSize: 11.5,
              fontFamily: 'var(--font-mono), SFMono-Regular, ui-monospace, monospace',
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TagComposer({ availableTags, existingTags = [], submitLabel, onSubmit, onCancel }: TagComposerProps) {
  const selectableTags = useMemo(
    () => availableTags.filter((tag) => !existingTags.includes(tag)),
    [availableTags, existingTags],
  );
  const [mode, setMode] = useState<'existing' | 'new'>(selectableTags.length > 0 ? 'existing' : 'new');
  const [selectedExisting, setSelectedExisting] = useState(selectableTags[0] ?? '');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (selectableTags.length === 0 && mode === 'existing') {
      setMode('new');
    }
  }, [mode, selectableTags.length]);

  useEffect(() => {
    if (mode === 'existing' && !selectableTags.includes(selectedExisting)) {
      setSelectedExisting(selectableTags[0] ?? '');
    }
  }, [mode, selectableTags, selectedExisting]);

  const canSubmit = mode === 'existing' ? Boolean(selectedExisting) : Boolean(newTag.trim());

  return (
    <div
      style={{
        ...floatingInsetStyle({ radius: 16, padding: 14, background: 'rgba(255, 255, 255, 0.72)' }),
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <FilterButton active={mode === 'existing'} onClick={() => setMode('existing')}>Use current tag</FilterButton>
        <FilterButton active={mode === 'new'} onClick={() => setMode('new')}>Create new</FilterButton>
      </div>

      {mode === 'existing' ? (
        selectableTags.length > 0 ? (
          <select
            value={selectedExisting}
            onChange={(event) => setSelectedExisting(event.target.value)}
            style={{
              borderRadius: 12,
              border: '1px solid rgba(200, 195, 188, 0.55)',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.9)',
              color: 'var(--text-body)',
              fontSize: 13,
            }}
          >
            {selectableTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            No reusable tags yet for this target, so the next useful move is creating one.
          </div>
        )
      ) : (
        <input
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
          placeholder="new tag"
          style={{
            borderRadius: 12,
            border: '1px solid rgba(200, 195, 188, 0.55)',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.9)',
            color: 'var(--text-body)',
            fontSize: 13,
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onSubmit(mode === 'existing' ? selectedExisting : newTag.trim())}
          className="floating-pill"
          disabled={!canSubmit}
          style={{ cursor: canSubmit ? 'pointer' : 'default', opacity: canSubmit ? 1 : 0.5 }}
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="floating-pill" style={{ cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  hidden,
  selected,
  tags,
  allTags,
  onToggleHidden,
  onToggleSelected,
  onAddTag,
  onRemoveTag,
  onSelectTag,
}: {
  skill: SkillSummary;
  hidden: boolean;
  selected: boolean;
  tags: string[];
  allTags: string[];
  onToggleHidden: () => void;
  onToggleSelected: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onSelectTag: (tag: string) => void;
}) {
  const [tagComposerOpen, setTagComposerOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const summaryPopoverRef = useRef<HTMLDivElement | null>(null);
  const status = statusBadge(skill, hidden);
  const source = sourceBadge(skill.source);
  const description = skill.description || 'No description available.';
  const hasLongDescription = description.length > 140;
  const conciseDescription = hasLongDescription ? `${description.slice(0, 137)}…` : description;

  useEffect(() => {
    if (!summaryOpen) return;

    function handlePointer(event: MouseEvent) {
      if (!summaryPopoverRef.current) return;
      if (summaryPopoverRef.current.contains(event.target as Node)) return;
      setSummaryOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSummaryOpen(false);
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [summaryOpen]);

  return (
    <details
      open={false}
      style={{
        ...cardStyle(hidden, skill.needsAttention),
        position: 'relative',
        opacity: hidden ? 0.82 : 1,
        boxShadow: selected ? '0 0 0 2px rgba(74, 109, 123, 0.18)' : undefined,
      }}
    >
      <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 19, lineHeight: 1 }}>{skill.emoji ?? '🧰'}</span>
                <div style={{ fontSize: 17, lineHeight: 1.14, fontWeight: 700, color: 'var(--text-body)', wordBreak: 'break-word' }}>{skill.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 8px', borderRadius: 999, background: source.bg, color: source.text, fontSize: 11, fontWeight: 700 }}>{source.label}</span>
                <span style={{ padding: '4px 8px', borderRadius: 999, background: status.bg, color: status.text, fontSize: 11, fontWeight: 700 }}>{status.label}</span>
                {skill.missingCount > 0 ? (
                  <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(255, 248, 240, 0.92)', color: '#8a6338', fontSize: 11, fontWeight: 700 }}>
                    {skill.missingCount} missing
                  </span>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <label
                onClick={(event) => {
                  event.stopPropagation();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 11.5,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onChange={() => onToggleSelected()}
                  style={{ accentColor: '#4a6d7b', cursor: 'pointer' }}
                />
                <span>Select</span>
              </label>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleHidden();
                }}
                className="floating-pill"
                style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {hidden ? 'Unhide' : 'Hide'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted-strong)', lineHeight: 1.62 }}>{conciseDescription}</div>
          </div>

          {tags.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectTag(tag);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(109, 145, 164, 0.18)',
                    background: 'rgba(238, 246, 250, 0.9)',
                    color: '#4a6d7b',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </summary>

      {hasLongDescription ? (
        <div style={{ marginTop: 10, display: 'flex' }}>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSummaryOpen((current) => !current);
            }}
            className="floating-pill"
            style={{ cursor: 'pointer' }}
          >
            {summaryOpen ? 'Close summary' : 'Read more'}
          </button>
        </div>
      ) : null}

      {summaryOpen ? (
        <div
          ref={summaryPopoverRef}
          onClick={(event) => event.stopPropagation()}
          style={{
            position: 'absolute',
            top: 84,
            left: 16,
            right: 16,
            zIndex: 20,
            ...floatingPanelStyle({
              padding: 16,
              radius: 18,
              borderColor: 'rgba(109, 145, 164, 0.26)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247, 241, 235, 0.96) 100%)',
            }),
            boxShadow: '0 20px 40px rgba(6, 46, 38, 0.14)',
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--muted)' }}>Full summary</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-body)' }}>{skill.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                className="floating-pill"
                style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Close
              </button>
            </div>
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                paddingRight: 6,
                fontSize: 12.75,
                lineHeight: 1.7,
                color: 'var(--muted-strong)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {description}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div style={floatingInsetStyle({ radius: 16, padding: 12, background: 'rgba(255,255,255,0.6)' })}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--muted)' }}>Availability</div>
            <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700 }}>{skill.eligible ? 'Ready from current setup' : 'Not currently eligible'}</div>
          </div>
          <div style={floatingInsetStyle({ radius: 16, padding: 12, background: 'rgba(255,255,255,0.6)' })}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--muted)' }}>Source</div>
            <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700 }}>{skill.sourceLabel}</div>
          </div>
        </div>

        {tags.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tags.map((tag) => (
              <button
                key={`remove-${tag}`}
                type="button"
                onClick={() => onRemoveTag(tag)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 9px',
                  borderRadius: 999,
                  border: '1px solid rgba(109, 145, 164, 0.18)',
                  background: 'rgba(238, 246, 250, 0.9)',
                  color: '#4a6d7b',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>#{tag}</span>
                <span style={{ opacity: 0.7 }}>×</span>
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTagComposerOpen((current) => !current)} className="floating-pill" style={{ cursor: 'pointer' }}>
            {tagComposerOpen ? 'Close tag editor' : 'Add tag'}
          </button>
          {skill.homepage ? (
            <a href={skill.homepage} target="_blank" rel="noreferrer" className="floating-pill" style={{ textDecoration: 'none' }}>
              Open homepage ↗
            </a>
          ) : null}
        </div>

        {tagComposerOpen ? (
          <TagComposer
            availableTags={allTags}
            existingTags={tags}
            submitLabel="Add tag"
            onSubmit={(tag) => {
              onAddTag(tag);
              setTagComposerOpen(false);
            }}
            onCancel={() => setTagComposerOpen(false)}
          />
        ) : null}

        {(skill.disabled || skill.blockedByAllowlist || skill.missingCount > 0) ? (
          <div
            style={{
              ...floatingInsetStyle({ radius: 16, padding: 14, background: 'rgba(255, 248, 240, 0.82)', borderColor: 'rgba(196, 130, 58, 0.22)' }),
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', color: '#8a6338' }}>Dependency and access detail</div>
              <div style={{ fontSize: 12.5, color: '#7b5a34', lineHeight: 1.6 }}>
                {skill.disabled
                  ? 'This skill is disabled.'
                  : skill.blockedByAllowlist
                    ? 'This skill is blocked by the current allowlist.'
                    : 'This skill is visible, but it still needs setup from the current environment.'}
              </div>
            </div>
            <MissingList title="Required bins" items={skill.missing.bins} />
            <MissingList title="Any-bin options" items={skill.missing.anyBins} />
            <MissingList title="Environment variables" items={skill.missing.env} />
            <MissingList title="Config keys" items={skill.missing.config} />
            <MissingList title="OS requirements" items={skill.missing.os} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function SkillsWorkspaceClient({ initialSummary }: { initialSummary: SkillsSummary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [view, setView] = useState<ViewFilter>('active');
  const [source, setSource] = useState<SourceFilter>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenSkills, setHiddenSkills] = useState<string[]>([]);
  const [tagMap, setTagMap] = useState<Record<string, string[]>>({});
  const [selectedSkillNames, setSelectedSkillNames] = useState<string[]>([]);
  const [selectionTagMode, setSelectionTagMode] = useState<'existing' | 'new'>('existing');
  const [selectionExistingTag, setSelectionExistingTag] = useState('');
  const [selectionNewTag, setSelectionNewTag] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreferencesLoaded, setIsPreferencesLoaded] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      const localHidden = loadJson<string[]>(HIDDEN_STORAGE_KEY, []);
      const localTags = loadJson<Record<string, string[]>>(TAGS_STORAGE_KEY, {});

      try {
        const response = await fetch(PREFERENCES_ENDPOINT, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load preferences');
        const remote = (await response.json()) as SkillsUiState;
        const hasRemoteState = remote.hiddenSkills.length > 0 || Object.keys(remote.tagMap).length > 0;

        if (!cancelled) {
          setHiddenSkills(remote.hiddenSkills);
          setTagMap(remote.tagMap);
          setIsPreferencesLoaded(true);
        }

        if (!hasRemoteState && (localHidden.length > 0 || Object.keys(localTags).length > 0)) {
          const migrated = { hiddenSkills: localHidden, tagMap: localTags };
          await fetch(PREFERENCES_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(migrated),
          });
          if (!cancelled) {
            setHiddenSkills(localHidden);
            setTagMap(localTags);
          }
        }
      } catch {
        if (!cancelled) {
          setHiddenSkills(localHidden);
          setTagMap(localTags);
          setIsPreferencesLoaded(true);
        }
      }
    }

    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPreferencesLoaded) return;

    persistJson(HIDDEN_STORAGE_KEY, hiddenSkills);
    persistJson(TAGS_STORAGE_KEY, tagMap);

    let cancelled = false;
    setIsSavingPreferences(true);

    const timeout = window.setTimeout(async () => {
      try {
        await fetch(PREFERENCES_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hiddenSkills, tagMap }),
        });
      } finally {
        if (!cancelled) setIsSavingPreferences(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [hiddenSkills, tagMap, isPreferencesLoaded]);

  const hiddenSet = useMemo(() => new Set(hiddenSkills), [hiddenSkills]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    Object.values(tagMap).forEach((entries) => entries.forEach((tag) => tag && tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [tagMap]);

  const scopedSkills = useMemo(() => {
    return summary.skills.filter((skill) => {
      if (!matchesSource(skill, source)) return false;
      if (selectedTag !== 'all' && !(tagMap[skill.name] ?? []).includes(selectedTag)) return false;
      return matchesView(skill, view);
    });
  }, [summary.skills, source, selectedTag, tagMap, view]);

  const visibleScopedSkills = useMemo(() => scopedSkills.filter((skill) => !hiddenSet.has(skill.name)), [scopedSkills, hiddenSet]);
  const hiddenScopedSkills = useMemo(() => scopedSkills.filter((skill) => hiddenSet.has(skill.name)), [scopedSkills, hiddenSet]);
  const displayedSkills = showHidden ? scopedSkills : visibleScopedSkills;

  const grouped = SOURCE_ORDER.map((sourceKey) => ({
    source: sourceKey,
    skills: displayedSkills.filter((skill) => skill.source === sourceKey),
  })).filter((group) => group.skills.length > 0);

  const selectedSkillSet = useMemo(() => new Set(selectedSkillNames), [selectedSkillNames]);
  const selectedSkills = useMemo(
    () => summary.skills.filter((skill) => selectedSkillSet.has(skill.name)),
    [summary.skills, selectedSkillSet],
  );
  const selectionRemovableTags = useMemo(() => {
    const tags = new Set<string>();
    selectedSkills.forEach((skill) => (tagMap[skill.name] ?? []).forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [selectedSkills, tagMap]);
  const activeSelectionTag = selectionTagMode === 'new' ? selectionNewTag.trim() : selectionExistingTag;
  const canAddSelectionTag = selectedSkillNames.length > 0 && Boolean(activeSelectionTag);
  const canRemoveSelectionTag = selectedSkillNames.length > 0 && selectionTagMode === 'existing' && Boolean(selectionExistingTag) && selectionRemovableTags.includes(selectionExistingTag);

  useEffect(() => {
    const validNames = new Set(summary.skills.map((skill) => skill.name));
    setSelectedSkillNames((current) => current.filter((name) => validNames.has(name)));
  }, [summary.skills]);

  useEffect(() => {
    if (allTags.length === 0 && selectionTagMode === 'existing') {
      setSelectionTagMode('new');
      return;
    }
    if (selectionTagMode === 'existing' && (!selectionExistingTag || !allTags.includes(selectionExistingTag))) {
      setSelectionExistingTag(allTags[0] ?? '');
    }
  }, [allTags, selectionExistingTag, selectionTagMode]);

  function persistHidden(next: string[]) {
    setHiddenSkills(next);
  }

  function persistTags(next: Record<string, string[]>) {
    setTagMap(next);
  }

  function toggleSelected(skillName: string) {
    setSelectedSkillNames((current) =>
      current.includes(skillName) ? current.filter((name) => name !== skillName) : [...current, skillName],
    );
  }

  function clearSelectedSkills() {
    setSelectedSkillNames([]);
  }

  function toggleHidden(skillName: string) {
    const next = hiddenSet.has(skillName)
      ? hiddenSkills.filter((name) => name !== skillName)
      : [...hiddenSkills, skillName].sort((a, b) => a.localeCompare(b));
    persistHidden(next);
  }

  function addTagToSkills(skillNames: string[], rawTag: string) {
    const tag = rawTag.trim();
    if (!tag) return;

    const nextMap = { ...tagMap };
    skillNames.forEach((skillName) => {
      const current = nextMap[skillName] ?? [];
      const nextTags = Array.from(new Set([...current, tag])).sort((a, b) => a.localeCompare(b));
      nextMap[skillName] = nextTags;
    });
    persistTags(nextMap);
  }

  function removeTagFromSkill(skillName: string, tag: string) {
    const nextMap = { ...tagMap };
    const nextTags = (nextMap[skillName] ?? []).filter((entry) => entry !== tag);
    if (nextTags.length === 0) delete nextMap[skillName];
    else nextMap[skillName] = nextTags;
    persistTags(nextMap);
    if (selectedTag !== 'all' && selectedTag === tag && !Object.values(nextMap).some((entries) => entries.includes(tag))) {
      setSelectedTag('all');
    }
  }

  function addSelectionTag() {
    if (!canAddSelectionTag) return;
    addTagToSkills(selectedSkillNames, activeSelectionTag);
    if (selectionTagMode === 'new') {
      setSelectionNewTag('');
      setSelectionTagMode('existing');
      setSelectionExistingTag(activeSelectionTag);
    }
  }

  function removeSelectionTag() {
    if (!canRemoveSelectionTag) return;
    const tag = selectionExistingTag;
    const nextMap = { ...tagMap };
    selectedSkillNames.forEach((skillName) => {
      const nextTags = (nextMap[skillName] ?? []).filter((entry) => entry !== tag);
      if (nextTags.length === 0) delete nextMap[skillName];
      else nextMap[skillName] = nextTags;
    });
    persistTags(nextMap);
    if (selectedTag !== 'all' && selectedTag === tag && !Object.values(nextMap).some((entries) => entries.includes(tag))) {
      setSelectedTag('all');
    }
  }

  function hideFiltered() {
    const names = visibleScopedSkills.map((skill) => skill.name);
    if (names.length === 0) return;
    persistHidden(Array.from(new Set([...hiddenSkills, ...names])).sort((a, b) => a.localeCompare(b)));
  }

  function unhideFiltered() {
    const names = new Set(hiddenScopedSkills.map((skill) => skill.name));
    if (names.size === 0) return;
    persistHidden(hiddenSkills.filter((name) => !names.has(name)));
  }

  async function refreshSkills() {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/skills', { cache: 'no-store' });
      const data = (await response.json()) as SkillsSummary;
      setSummary(data);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section
        style={{
          ...floatingPanelStyle({
            padding: 18,
            borderColor: 'rgba(121, 166, 148, 0.22)',
            background: 'linear-gradient(180deg, rgba(248, 246, 242, 0.94) 0%, rgba(255, 255, 255, 0.82) 100%)',
          }),
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--accent-mid)', fontWeight: 700 }}>Skills</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>
              {displayedSkills.length} shown · {hiddenScopedSkills.length} hidden in scope · {summary.skills.length} total in registry · refreshed {formatTimestamp(summary.refreshedAt)}{isSavingPreferences ? ' · saving preferences…' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={refreshSkills} className="floating-pill" style={{ cursor: 'pointer', opacity: isRefreshing ? 0.65 : 1 }}>
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button" onClick={() => setShowHidden((current) => !current)} className={`floating-pill${showHidden ? ' floating-pill-active' : ''}`} style={{ cursor: 'pointer' }}>
              {showHidden ? 'Hide hidden skills' : `Show hidden (${hiddenSkills.length})`}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 0.95fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="floating-pill-row">
              {[
                ['all', `All (${summary.skills.length})`],
                ['active', `Active (${summary.skills.filter((skill) => matchesView(skill, 'active')).length})`],
                ['needs-attention', `Needs attention (${summary.skills.filter((skill) => matchesView(skill, 'needs-attention')).length})`],
              ].map(([key, label]) => (
                <FilterButton key={key} active={view === key} onClick={() => setView(key as ViewFilter)}>{label}</FilterButton>
              ))}
            </div>

            <div className="floating-pill-row">
              {[
                ['all', 'All sources'],
                ['bundled', `Bundled (${summary.skills.filter((skill) => skill.source === 'bundled').length})`],
                ['workspace', `Workspace (${summary.skills.filter((skill) => skill.source === 'workspace').length})`],
                ['clawhub', `ClawHub (${summary.skills.filter((skill) => skill.source === 'clawhub').length})`],
                ...(summary.skills.some((skill) => skill.source === 'other') ? [['other', `Other (${summary.skills.filter((skill) => skill.source === 'other').length})`]] : []),
              ].map(([key, label]) => (
                <FilterButton key={key} active={source === key} onClick={() => setSource(key as SourceFilter)}>{label}</FilterButton>
              ))}
            </div>
          </div>

          <div
            style={{
              ...floatingInsetStyle({ radius: 18, padding: 14, background: 'rgba(255,255,255,0.54)' }),
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--muted)' }}>Manual tags</div>
              {selectedSkillNames.length > 0 ? (
                <button type="button" onClick={clearSelectedSkills} className="floating-pill" style={{ cursor: 'pointer' }}>
                  Clear selection ({selectedSkillNames.length})
                </button>
              ) : null}
            </div>

            {allTags.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                No custom tags yet. Add them from a skill card, then use them here as a filter.
              </div>
            ) : (
              <div className="floating-pill-row">
                <FilterButton active={selectedTag === 'all'} onClick={() => setSelectedTag('all')}>All tags</FilterButton>
                {allTags.map((tag) => (
                  <FilterButton key={tag} active={selectedTag === tag} onClick={() => setSelectedTag(tag)}>#{tag}</FilterButton>
                ))}
              </div>
            )}

            {selectedTag !== 'all' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {visibleScopedSkills.length > 0 ? (
                  <button type="button" onClick={hideFiltered} className="floating-pill" style={{ cursor: 'pointer' }}>
                    Hide tag selection ({visibleScopedSkills.length})
                  </button>
                ) : null}
                {hiddenScopedSkills.length > 0 ? (
                  <button type="button" onClick={unhideFiltered} className="floating-pill" style={{ cursor: 'pointer' }}>
                    Unhide tag selection ({hiddenScopedSkills.length})
                  </button>
                ) : null}
              </div>
            ) : null}

            {selectedSkillNames.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  justifyItems: 'end',
                  borderTop: '1px solid rgba(200, 195, 188, 0.4)',
                  paddingTop: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <FilterButton active={selectionTagMode === 'existing'} onClick={() => setSelectionTagMode('existing')}>Use current tag</FilterButton>
                  <FilterButton active={selectionTagMode === 'new'} onClick={() => setSelectionTagMode('new')}>Create new</FilterButton>
                </div>

                {selectionTagMode === 'existing' ? (
                  allTags.length > 0 ? (
                    <select
                      value={selectionExistingTag}
                      onChange={(event) => setSelectionExistingTag(event.target.value)}
                      style={{
                        minWidth: 220,
                        borderRadius: 12,
                        border: '1px solid rgba(200, 195, 188, 0.55)',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.9)',
                        color: 'var(--text-body)',
                        fontSize: 13,
                      }}
                    >
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>
                          #{tag}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, textAlign: 'right' }}>
                      No existing tags yet, so create a new one first.
                    </div>
                  )
                ) : (
                  <input
                    value={selectionNewTag}
                    onChange={(event) => setSelectionNewTag(event.target.value)}
                    placeholder="new tag"
                    style={{
                      minWidth: 220,
                      borderRadius: 12,
                      border: '1px solid rgba(200, 195, 188, 0.55)',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.9)',
                      color: 'var(--text-body)',
                      fontSize: 13,
                    }}
                  />
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={addSelectionTag}
                    className="floating-pill"
                    disabled={!canAddSelectionTag}
                    style={{ cursor: canAddSelectionTag ? 'pointer' : 'default', opacity: canAddSelectionTag ? 1 : 0.5 }}
                  >
                    Add tag to selected ({selectedSkillNames.length})
                  </button>
                  <button
                    type="button"
                    onClick={removeSelectionTag}
                    className="floating-pill"
                    disabled={!canRemoveSelectionTag}
                    style={{ cursor: canRemoveSelectionTag ? 'pointer' : 'default', opacity: canRemoveSelectionTag ? 1 : 0.5 }}
                  >
                    Remove tag from selection
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {summary.error ? (
        <section style={{ ...floatingPanelStyle({ borderColor: 'rgba(248,113,113,0.28)', padding: 18 }), color: '#8b3f3f', textAlign: 'center' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 18, lineHeight: 1.25 }}>Skills could not be loaded cleanly.</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.62 }}>{summary.error}</div>
          </div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gap: 16 }}>
        {displayedSkills.length === 0 ? (
          <div style={{ ...floatingPanelStyle({ padding: 24 }), textAlign: 'center', color: 'var(--muted)' }}>
            No skills match the current filters.
          </div>
        ) : (
          grouped.map((group) => {
            const title = group.source === 'bundled' ? 'Bundled skills' : group.source === 'workspace' ? 'Workspace skills' : group.source === 'clawhub' ? 'ClawHub skills' : 'Other skills';
            return (
              <details key={group.source} open={source !== 'all' || group.source === 'bundled' || group.source === 'workspace'}>
                <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--accent-mid)', fontWeight: 700 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 11px', background: 'rgba(255,255,255,0.62)' }}>
                      {group.skills.length} skill{group.skills.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 14 }}>
                  {group.skills.map((skill) => (
                    <SkillCard
                      key={skill.name}
                      skill={skill}
                      hidden={hiddenSet.has(skill.name)}
                      selected={selectedSkillSet.has(skill.name)}
                      tags={tagMap[skill.name] ?? []}
                      allTags={allTags}
                      onToggleHidden={() => toggleHidden(skill.name)}
                      onToggleSelected={() => toggleSelected(skill.name)}
                      onAddTag={(tag) => addTagToSkills([skill.name], tag)}
                      onRemoveTag={(tag) => removeTagFromSkill(skill.name, tag)}
                      onSelectTag={(tag) => setSelectedTag(tag)}
                    />
                  ))}
                </div>
              </details>
            );
          })
        )}
      </section>

      <BackToTopButton />
    </div>
  );
}
