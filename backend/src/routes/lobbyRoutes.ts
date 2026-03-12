import { Router } from 'express';
import { createLobby, joinLobby, getLobbyState, addItemToLobby, lockLobby, payShare, verifyShare } from '../controllers/lobbyController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.post('/create', authenticateJWT, createLobby);
router.post('/join', authenticateJWT, joinLobby);
router.get('/:code/state', authenticateJWT, getLobbyState);
router.post('/add-item', authenticateJWT, addItemToLobby);
router.post('/lock', authenticateJWT, lockLobby);
router.post('/pay-share', authenticateJWT, payShare);
router.post('/verify-share', authenticateJWT, verifyShare);

export default router;
