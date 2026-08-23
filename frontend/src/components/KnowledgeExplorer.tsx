import ReactMarkdown from 'react-markdown';
import { Brain, Folder, FileText, X } from 'lucide-react';

type KnowledgeExplorerProps = {
  files: Record<string, string[]>;
  fetchFiles: () => void;
  readFile: (dir: string, file: string) => void;
  selectedFile: { dir: string, file: string, content: string } | null;
  setSelectedFile: (file: { dir: string, file: string, content: string } | null) => void;
};

export function KnowledgeExplorer({
  files,
  fetchFiles,
  readFile,
  selectedFile,
  setSelectedFile,
}: KnowledgeExplorerProps) {
  return (
    <aside className="log-sidebar" style={{ width: '400px', borderLeft: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div className="log-header" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Brain size={18} color="#3b82f6" /> Knowledge Base
        </h2>
        <button onClick={fetchFiles} style={{ fontSize: '0.8rem', cursor: 'pointer', background: 'none', border: 'none', color: '#3b82f6' }}>Refresh</button>
      </div>
      <div className="file-explorer-content" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {Object.entries(files).map(([dir, fileList]) => (
          <div key={dir} style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Folder size={12} /> {dir}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {fileList.map(file => (
                <button 
                  key={file} 
                  onClick={() => readFile(dir, file)}
                  style={{ 
                    textAlign: 'left', 
                    padding: '0.4rem 0.6rem', 
                    fontSize: '0.8rem', 
                    background: selectedFile?.file === file ? '#eff6ff' : 'white', 
                    border: '1px solid', 
                    borderColor: selectedFile?.file === file ? '#3b82f6' : '#e2e8f0', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    color: selectedFile?.file === file ? '#1e40af' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <FileText size={14} color={selectedFile?.file === file ? '#3b82f6' : '#94a3b8'} />
                  {file}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {selectedFile && (
        <div className="file-content-preview" style={{ height: '40%', borderTop: '2px solid #e2e8f0', background: 'white', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.5rem 1rem', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{selectedFile.dir} / {selectedFile.file}</span>
            <button onClick={() => setSelectedFile(null)}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', fontSize: '0.85rem' }}>
            {selectedFile.file.endsWith('.md') ? (
              <ReactMarkdown>{selectedFile.content}</ReactMarkdown>
            ) : (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selectedFile.content}</pre>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
