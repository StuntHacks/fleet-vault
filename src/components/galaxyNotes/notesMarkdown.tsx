import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const remarkPlugins = [remarkGfm, remarkBreaks];

export default function NotesMarkdown({ children }: { children: string }) {
    return (
        <Markdown
            remarkPlugins={remarkPlugins}
            components={{ a: ({ node, children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> }}
        >
            {children}
        </Markdown>
    );
}
