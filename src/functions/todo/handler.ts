import 'source-map-support/register';

import { middyfy } from '@libs/lambda';

// http
import { create } from './http/create';
import { list } from './http/list';
import { update } from './http/update';
import { _delete } from './http/delete';

export const createTodo = middyfy(create);
export const getAllTodos = middyfy(list);
export const updateTodo = middyfy(update);
export const deleteTodo = middyfy(_delete);
