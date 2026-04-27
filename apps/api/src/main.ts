const bootstrap = (): void => {
  const sampleResponse = {
    id: "sample-job-id",
    status: "queued",
    createdAt: new Date().toISOString()
  };

  console.log("[api] scaffold ready", sampleResponse);
};

bootstrap();
