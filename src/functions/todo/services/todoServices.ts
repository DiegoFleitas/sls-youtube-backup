import { v4 as uuidv4 } from 'uuid';
import { TodoRepository } from '../repositories/todoRepositories';
import { TodoItem } from '../model/todoItem';

export class TodoService {
    private readonly todoRepository: TodoRepository;
    
    constructor(todoRepository: TodoRepository = new TodoRepository()) {
        this.todoRepository = todoRepository; 
    }

    async getAllTodos(): Promise<TodoItem[]> {
        return this.todoRepository.getAllTodos();
    }

    async createTodo(name: string): Promise<TodoItem> {
        const id = uuidv4();
        return await this.todoRepository.createTodo({
            id,
            name,
            done: false,
            createdAt: new Date().toISOString()
        })
    }

    async updateTodo(partialTodo: Partial<TodoItem>) {
        return await this.todoRepository.updateTodo(partialTodo);
    }

    async deleteTodoById(id: string) {
        return await this.todoRepository.deleteTodoById(id);
    }
}
