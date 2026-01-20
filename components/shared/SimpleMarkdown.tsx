// Rodrigo Osorio v0.5 - Parser de Markdown simple y ligero
import React from 'react';
import { Link } from 'react-router-dom';

interface SimpleMarkdownProps {
  text: string;
  className?: string;
  onLinkClick?: () => void;
}

// Convierte markdown básico a elementos React
export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ text, className = '', onLinkClick }) => {
  const parseMarkdown = (content: string): React.ReactNode[] => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let inList = false;

    const processInlineMarkdown = (line: string): React.ReactNode => {
      // Procesar negritas **texto** y *texto* para cursiva
      const parts: React.ReactNode[] = [];
      let remaining = line;
      let key = 0;

      while (remaining.length > 0) {
        // Buscar [enlace](url)
        const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
        // Buscar **negrita**
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Buscar *cursiva*
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
        // Buscar !!alerta!! (más robusto: no permite ! dentro para evitar falsos positivos)
        const alertMatch = remaining.match(/!!([^!]+)!!/);

        // Determinar qué match ocurre primero
        const matches = [
          { type: 'link', match: linkMatch },
          { type: 'bold', match: boldMatch },
          { type: 'italic', match: italicMatch },
          { type: 'alert', match: alertMatch }
        ].filter(m => m.match).sort((a, b) => a.match!.index! - b.match!.index!);

        const first = matches[0];

        if (!first) {
          parts.push(<span key={key++}>{remaining}</span>);
          remaining = '';
        } else {
          // Agregar texto antes del match
          const before = remaining.substring(0, first.match!.index);
          if (before) parts.push(<span key={key++}>{before}</span>);

          if (first.type === 'link') {
            const [, text, url] = first.match!;
            const isInternal = url.startsWith('/') || url.startsWith('#');
            if (isInternal) {
              parts.push(
                <Link
                  key={key++}
                  to={url}
                  onClick={onLinkClick} // Trigger callback on click
                  className="text-brand-600 font-bold hover:underline bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200 inline-flex items-center gap-1 mx-1 transition-colors hover:bg-brand-100"
                >
                  {processInlineMarkdown(text)}
                </Link>
              );
            } else {
              parts.push(
                <a
                  key={key++}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 underline"
                >
                  {processInlineMarkdown(text)}
                </a>
              );
            }
          } else if (first.type === 'bold') {
            parts.push(<strong key={key++} className="font-bold text-slate-900">{processInlineMarkdown(first.match![1])}</strong>);
          } else if (first.type === 'italic') {
            parts.push(<em key={key++} className="italic">{processInlineMarkdown(first.match![1])}</em>);
          } else if (first.type === 'alert') {
            // Rodrigo Osorio v0.15 - Estilo de alerta más prominente (Rojo Intenso + Fondo)
            parts.push(
              <span key={key++} className="inline-block px-1.5 py-0.5 mx-0.5 rounded font-bold text-red-600 bg-red-50 border border-red-100 animate-pulse-subtle">
                {processInlineMarkdown(first.match![1])}
              </span>
            );
          }

          remaining = remaining.substring(first.match!.index! + first.match![0].length);
        }
      }

      return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside space-y-1 my-2 ml-2">
            {listItems.map((item, i) => (
              <li key={i} className="text-slate-700">{processInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Detectar items de lista (* item o - item)
      const listMatch = trimmedLine.match(/^[\*\-]\s+(.+)$/);

      if (listMatch) {
        inList = true;
        listItems.push(listMatch[1]);
      } else {
        // Si estábamos en una lista, cerrarla
        flushList();

        // Línea vacía
        if (trimmedLine === '') {
          elements.push(<div key={index} className="h-2" />);
        }
        // Encabezado con ##
        else if (trimmedLine.startsWith('##')) {
          const headerText = trimmedLine.replace(/^#+\s*/, '');
          elements.push(
            <h3 key={index} className="font-semibold text-slate-800 mt-3 mb-1">
              {processInlineMarkdown(headerText)}
            </h3>
          );
        }
        // Línea normal
        else {
          elements.push(
            <p key={index} className="text-slate-700">
              {processInlineMarkdown(trimmedLine)}
            </p>
          );
        }
      }
    });

    // Cerrar lista pendiente al final
    flushList();

    return elements;
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {parseMarkdown(text)}
    </div>
  );
};

export default SimpleMarkdown;

