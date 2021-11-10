const createTweetSchema = {
    type: "object",
    properties: {
        text: { type: 'string' }
    },
    required: ['text']
  }
  
  export { createTweetSchema };