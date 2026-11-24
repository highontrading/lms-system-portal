export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-fade-in px-4 py-6 opacity-0 [animation-delay:180ms] sm:px-6 sm:py-8" role="status" aria-label="Loading lesson">
      <div className="skeleton aspect-video w-full" />
      <div className="skeleton mt-6 h-8 w-2/3" />
      <div className="skeleton mt-3 h-4 w-full" />
      <div className="skeleton mt-2 h-4 w-5/6" />
    </div>
  );
}
