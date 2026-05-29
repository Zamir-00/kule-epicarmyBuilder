import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/build/$listId')({
  component: BuilderStub,
});

function BuilderStub() {
  const { listId } = Route.useParams();
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">Builder for {listId}</h1>
      <p className="mt-2 text-muted-foreground">
        The actual list builder lands in S3.5. This is a placeholder.
      </p>
    </main>
  );
}
