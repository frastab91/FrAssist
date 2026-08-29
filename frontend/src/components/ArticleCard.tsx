import { ExternalLink, Newspaper, Globe } from 'lucide-react';

type ArticleItem = {
  title: string;
  url: string;
  summary: string;
};

type ArticleCardProps = {
  data: string;
};

function parseArticles(data: string): ArticleItem[] {
  // Support multiple articles separated by '---' or multiple 'Title:' headers
  const rawSections = data.split(/\n\s*---\s*\n/).filter(s => s.trim().length > 0);
  const items: ArticleItem[] = [];

  const parseSection = (section: string): ArticleItem | null => {
    let title = '';
    let url = '';
    let summary = '';
    let currentKey = '';

    const lines = section.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('title:')) {
        title = trimmed.substring(6).trim();
        currentKey = 'title';
      } else if (trimmed.toLowerCase().startsWith('url:')) {
        url = trimmed.substring(4).trim();
        currentKey = 'url';
      } else if (trimmed.toLowerCase().startsWith('summary:')) {
        summary = trimmed.substring(8).trim();
        currentKey = 'summary';
      } else if (trimmed) {
        if (currentKey === 'summary') {
          summary += (summary ? ' ' : '') + trimmed;
        } else if (currentKey === 'title') {
          title += (title ? ' ' : '') + trimmed;
        }
      }
    }

    if (title || url || summary) {
      return { title: title || 'Article', url, summary };
    }
    return null;
  };

  for (const sec of rawSections) {
    // Check if a single section has multiple "Title:" declarations without '---'
    const titleMatches = sec.split(/(?=\bTitle:)/i);
    if (titleMatches.length > 1) {
      for (const sub of titleMatches) {
        const item = parseSection(sub);
        if (item) items.push(item);
      }
    } else {
      const item = parseSection(sec);
      if (item) items.push(item);
    }
  }

  return items;
}

export function ArticleCard({ data }: ArticleCardProps) {
  const articles = parseArticles(data);

  if (articles.length === 0) {
    return (
      <div style={{
        padding: '0.75rem 1rem',
        background: '#f8fafc',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        margin: '0.5rem 0',
        fontSize: '0.82rem',
        color: '#334155',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {data}
      </div>
    );
  }

  return (
    <div 
      className="articles-horizontal-track"
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'stretch',
        gap: '0.85rem',
        overflowX: 'auto',
        padding: '0.5rem 0.25rem 0.75rem 0.25rem',
        margin: '0.6rem 0',
        WebkitOverflowScrolling: 'touch',
        scrollSnapType: 'x mandatory',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}
    >
      {articles.map((art, idx) => {
        let domain = '';
        try {
          if (art.url) {
            domain = new URL(art.url.startsWith('http') ? art.url : `https://${art.url}`).hostname.replace(/^www\./, '');
          }
        } catch (e) {}

        return (
          <div
            key={idx}
            className="article-card-item"
            style={{
              width: '280px',
              minWidth: '280px',
              maxWidth: '280px',
              flexShrink: 0,
              flexGrow: 0,
              scrollSnapAlign: 'start',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxSizing: 'border-box'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px -2px rgba(0, 0, 0, 0.08), 0 3px 6px -2px rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div>
              {/* Header Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#eff6ff',
                  color: '#2563eb',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600
                }}>
                  <Newspaper size={13} />
                  <span>Article {articles.length > 1 ? `#${idx + 1}` : ''}</span>
                </div>

                {domain && (
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#64748b',
                    fontWeight: 500,
                    maxWidth: '130px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Globe size={11} /> {domain}
                  </span>
                )}
              </div>

              {/* Title with 2-line constraint */}
              <h4 
                title={art.title}
                style={{
                  margin: '0 0 0.4rem 0',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-word',
                  minHeight: '2.4em'
                }}
              >
                {art.title}
              </h4>

              {/* Summary with 3-line constraint */}
              {art.summary && (
                <p 
                  title={art.summary}
                  style={{
                    margin: '0 0 0.85rem 0',
                    fontSize: '0.78rem',
                    color: '#475569',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    wordBreak: 'break-word'
                  }}
                >
                  {art.summary}
                </p>
              )}
            </div>

            {/* Footer / Link */}
            {art.url && (
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <a 
                  href={art.url.startsWith('http') ? art.url : `https://${art.url}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    width: '100%',
                    background: '#f8fafc',
                    color: '#2563eb',
                    border: '1px solid #e2e8f0',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '7px',
                    textDecoration: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#2563eb';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <span>Read Article</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
