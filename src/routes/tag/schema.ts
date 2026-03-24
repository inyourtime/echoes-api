import Type from 'typebox'

// Tag info
const TagInfo = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  name: Type.String(),
  color: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
})

// Create tag
export const CreateTagBody = Type.Object({
  name: Type.String({ minLength: 1, description: 'Tag name' }),
  color: Type.Optional(Type.String({ description: 'Hex color code' })),
})

export const CreateTagResponse = Type.Object({
  tag: TagInfo,
})

// Update tag
export const UpdateTagBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, description: 'Tag name' })),
  color: Type.Optional(Type.String({ description: 'Hex color code' })),
})

export const UpdateTagResponse = Type.Object({
  tag: TagInfo,
})

// List tags
export const ListTagsResponse = Type.Object({
  tags: Type.Array(TagInfo),
})

// Get single tag
export const GetTagResponse = Type.Object({
  tag: TagInfo,
})
