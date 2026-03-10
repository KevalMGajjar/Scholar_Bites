import { Router } from 'express';
import { getRestaurantsByUniversity, createRestaurant } from '../controllers/restaurantController';

const router = Router();

// Public route to get restaurants for a specific university
router.get('/university/:university_id', getRestaurantsByUniversity);

// Admin route to create a new restaurant (simplified, missing auth middleware for now)
router.post('/', createRestaurant);

export default router;
