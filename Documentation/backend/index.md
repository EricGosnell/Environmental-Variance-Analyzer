# Backend Documentation

Welcome to the backend documentation for the Environmental Variance Analyzer (EVA) project. 

This directory contains technical details regarding the server structure, databases, security protocols, and testing practices.

> **Note:** For API Endpoints and payload definitions, please see the separate [API Routes](../API_routes.md) document.

## Table of Contents

1. [Architecture & Server Setup](./architecture.md)
   - Learn about the entry point, tech stack, and routing layout.
2. [Database Schema](./database.md)
   - Details regarding the SQLite3 entities, relationships, and abstractions.
3. [Authentication & Security](./authentication.md)
   - Information on JWT lifecycles, XSS sanitization, password hashing, and email integration.
4. [Testing Suite](./testing.md)
   - How to run tests, configure the in-memory testing database, and generate mock data.