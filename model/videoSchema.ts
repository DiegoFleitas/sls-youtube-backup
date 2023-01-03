const createVideoSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
  },
  required: ["title"],
};

export { createVideoSchema };
