const createTodoSchema = {
  type: "object",
  properties: {
      name: { type: 'string' }
  },
  required: ['name']
}

export { createTodoSchema };
