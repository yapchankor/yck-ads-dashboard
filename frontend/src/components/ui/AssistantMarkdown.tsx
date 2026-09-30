import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function safeLink(url: string) {
  const isInternalPath = url.startsWith("/") && !url.startsWith("//");
  return /^https:\/\//i.test(url) || isInternalPath ? url : "";
}

export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeLink}
        components={{
          p: ({ children }) => <p className="my-1 whitespace-pre-wrap first:mt-0 last:mb-0">{children}</p>,
          h1: ({ children }) => <p className="mb-1 mt-2 font-bold first:mt-0">{children}</p>,
          h2: ({ children }) => <p className="mb-1 mt-2 font-bold first:mt-0">{children}</p>,
          h3: ({ children }) => <p className="mb-0.5 mt-2 font-bold first:mt-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-accent-primary/40 pl-3 text-text-muted">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => href ? (
            <a
              href={href}
              target={href.startsWith("/") ? undefined : "_blank"}
              rel={href.startsWith("/") ? undefined : "noreferrer"}
              className="font-medium text-accent-primary underline underline-offset-2"
            >
              {children}
            </a>
          ) : <span>{children}</span>,
          code: ({ children }) => (
            <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[12px]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-surface-hover p-3 text-[12px] leading-relaxed">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border/60 bg-surface-hover px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-border/60 px-2 py-1 align-top">{children}</td>,
          img: ({ alt }) => <span>{alt || "Image"}</span>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
