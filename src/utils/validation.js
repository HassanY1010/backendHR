import { z } from 'zod';

export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (e) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: e.errors
        });
    }
};

export const authSchemas = {
    login: z.object({
        body: z.object({
            email: z.string().email('Invalid email address'),
            password: z.string().min(6, 'Password must be at least 6 characters'),
        })
    }),
    register: z.object({
        body: z.object({
            name: z.string().min(2, 'Name must be at least 2 characters'),
            email: z.string().email('Invalid email address'),
            password: z.string().min(8, 'Password must be at least 8 characters'),
            companyName: z.string().optional(),
            subscriptionCode: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
        })
    }),
    createTask: z.object({
        body: z.object({
            title: z.string().min(1, 'Title is required'),
            description: z.string().optional(),
            priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
            dueDate: z.string().optional(),
            employeeId: z.string().optional(),
        })
    }),
    updateTask: z.object({
        body: z.object({
            title: z.string().optional(),
            status: z.string().optional(),
            priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
            progress: z.number().min(0).max(100).optional(),
        })
    }),
    employee: z.object({
        body: z.object({
            name: z.string().min(2),
            email: z.string().email(),
            department: z.string().optional(),
            position: z.string().optional(),
            status: z.string().optional(),
        })
    })
};
