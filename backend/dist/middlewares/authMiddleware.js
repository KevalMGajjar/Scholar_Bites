"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRole = exports.authenticateJWT = void 0;
const jwt_1 = require("../utils/jwt");
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const user = (0, jwt_1.verifyToken)(token);
        if (user) {
            req.user = user;
            next();
        }
        else {
            res.sendStatus(403);
        }
    }
    else {
        res.sendStatus(401);
    }
};
exports.authenticateJWT = authenticateJWT;
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (req.user && roles.includes(req.user.role)) {
            next();
        }
        else {
            res.sendStatus(403);
        }
    };
};
exports.authorizeRole = authorizeRole;
