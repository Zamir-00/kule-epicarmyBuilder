import { Button } from '@/components/ui/button';

export default function App() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
            <h1 className="text-4xl font-bold">Kule Army Builder</h1>
            <p className="text-muted-foreground">
                Stage 3 scaffold — routing and content arrives in S3.3 onward.
            </p>
            <div className="flex gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
            </div>
        </div>
    );
}
