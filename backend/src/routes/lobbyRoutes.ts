import { Router } from 'express';
import { createLobby, joinLobby, leaveLobby, getLobbyState, addItemToLobby, removeItemFromLobby, lockLobby, unlockLobby, payShare, verifyShare, getActiveGroup } from '../controllers/lobbyController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.post('/create', authenticateJWT, createLobby);
router.post('/join', authenticateJWT, joinLobby);
router.post('/leave', authenticateJWT, leaveLobby);
router.get('/active', authenticateJWT, getActiveGroup);
router.get('/:code/state', authenticateJWT, getLobbyState);
router.post('/add-item', authenticateJWT, addItemToLobby);
router.post('/remove-item', authenticateJWT, removeItemFromLobby);
router.post('/lock', authenticateJWT, lockLobby);
router.post('/unlock', authenticateJWT, unlockLobby);
router.post('/pay-share', authenticateJWT, payShare);
router.post('/verify-share', authenticateJWT, verifyShare);

export default router;
