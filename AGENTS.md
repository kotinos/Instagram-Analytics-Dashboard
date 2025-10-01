# AGENTS.md - AI Development Guidelines

## 📋 Overview

This document provides comprehensive guidelines for AI agents working on the Instagram Analytics Dashboard project. Follow these instructions to ensure consistent, high-quality code generation that aligns with project standards and best practices.

## 🎯 Project Context

**Project**: Instagram Analytics Dashboard  
**Type**: Desktop Application (Electron + React + TypeScript)  
**Purpose**: Monitor Instagram creator metrics with automated data collection  
**Target Platform**: Windows Desktop  
**Architecture**: Main/Renderer process separation with IPC communication

## 🔧 Core Development Rules

### **ALWAYS**
- ✅ Use TypeScript with strict mode enabled
- ✅ Implement proper error boundaries in React components
- ✅ Use async/await over callbacks or raw promises
- ✅ Include comprehensive JSDoc comments for public APIs
- ✅ Validate all user inputs with Joi schemas
- ✅ Use prepared statements for all database queries
- ✅ Implement loading states for async operations
- ✅ Add proper TypeScript types (no `any` unless absolutely necessary)
- ✅ Use semantic HTML elements
- ✅ Follow React Hooks rules and dependencies

### **NEVER**
- ❌ Hardcode sensitive values (use environment variables)
- ❌ Use `var` declarations (use `const` or `let`)
- ❌ Manipulate DOM directly in React components
- ❌ Store passwords or tokens in plain text
- ❌ Use synchronous file operations in the renderer process
- ❌ Ignore error handling in async functions
- ❌ Use inline styles (use Material-UI's sx prop or styled components)
- ❌ Commit console.log statements (use Winston logger)
- ❌ Mix business logic with UI components
- ❌ Use magic numbers (define constants)

## 📦 Technology Stack Preferences

### **Required Libraries & Versions**

```typescript
// ALWAYS use these specific packages and versions
{
  // Core - DO NOT substitute
  "electron": "^27.0.0",          // Not older versions
  "react": "^18.2.0",             // Use React 18 features
  "typescript": "^5.0.0",         // Strict mode required
  
  // Database - MUST use better-sqlite3
  "better-sqlite3": "^9.0.0",     // NOT sqlite3 (native bindings issues)
  
  // UI Framework - Material-UI v5 only
  "@mui/material": "^5.14.0",     // NOT v4 or other UI libraries
  "@mui/x-data-grid": "^6.18.0",  // For table components
  
  // Web Scraping - Puppeteer with Stealth
  "puppeteer": "^21.0.0",         // NOT playwright
  "puppeteer-extra": "^3.3.6",
  "puppeteer-extra-plugin-stealth": "^2.11.2",
  
  // State Management
  "@reduxjs/toolkit": "^2.0.0",   // NOT plain Redux
  "react-redux": "^9.0.0",
  
  // Validation
  "joi": "^17.11.0",              // NOT yup or zod
  
  // Logging
  "winston": "^3.11.0",           // NOT bunyan or pino
  
  // Testing
  "vitest": "^1.0.0",             // NOT jest
  "@testing-library/react": "^14.0.0"
}
```

### **Import Conventions**

```typescript
// CORRECT import order and grouping
// 1. Node/Electron built-ins
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';

// 2. External packages
import React, { useState, useEffect } from 'react';
import { Box, Grid } from '@mui/material';
import Database from 'better-sqlite3';

// 3. Internal absolute imports
import { DatabaseService } from '@/services/database';
import { useCreators } from '@/hooks/useCreators';

// 4. Relative imports
import { CreatorCard } from './CreatorCard';
import type { Creator } from '../types';

// 5. Style imports (last)
import styles from './Dashboard.module.css';
```

## 🏗 Project Structure Rules

### **File Naming Conventions**

```typescript
// Components: PascalCase with .tsx extension
components/Dashboard/Dashboard.tsx         ✅
components/dashboard/dashboard.tsx         ❌

// Hooks: camelCase starting with 'use'
hooks/useCreators.ts                      ✅
hooks/CreatorHook.ts                      ❌

// Services: PascalCase with Service suffix
services/DatabaseService.ts               ✅
services/database.ts                      ❌

// Utils: camelCase
utils/formatters.ts                       ✅
utils/Formatters.ts                       ❌

// Constants: SCREAMING_SNAKE_CASE in file
constants/API_ENDPOINTS.ts                ✅
constants/apiEndpoints.ts                 ❌

// Types: PascalCase for types/interfaces
types/Creator.ts                          ✅
types/creator.ts                          ❌
```

### **Component Structure Pattern**

```typescript
// ALWAYS structure components this way
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { ComponentProps } from './types';

/**
 * Dashboard component for displaying creator analytics
 * @component
 * @param {ComponentProps} props - Component properties
 */
export const Dashboard: React.FC<ComponentProps> = React.memo(({ 
  initialCreatorId,
  onRefresh 
}) => {
  // 1. Redux hooks
  const dispatch = useAppDispatch();
  const creators = useAppSelector(state => state.creators.list);
  
  // 2. Local state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // 3. Refs
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 4. Custom hooks
  const { metrics, refreshMetrics } = useMetrics(initialCreatorId);
  
  // 5. Memoized values
  const sortedCreators = useMemo(() => 
    [...creators].sort((a, b) => b.followerCount - a.followerCount),
    [creators]
  );
  
  // 6. Callbacks
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await onRefresh?.();
      await refreshMetrics();
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [onRefresh, refreshMetrics]);
  
  // 7. Effects
  useEffect(() => {
    // Initial load
    handleRefresh();
  }, [initialCreatorId]);
  
  // 8. Early returns
  if (error) {
    return <ErrorBoundary error={error} />;
  }
  
  // 9. Main render
  return (
    <Box ref={containerRef} sx={{ p: 3 }}>
      {/* Component JSX */}
    </Box>
  );
});

Dashboard.displayName = 'Dashboard';
```

## 💾 Database Guidelines

### **Query Patterns**

```typescript
// ALWAYS use parameterized queries
// ✅ CORRECT
const stmt = db.prepare('SELECT * FROM creators WHERE username = ?');
const creator = stmt.get(username);

// ❌ WRONG - SQL injection risk
const creator = db.exec(`SELECT * FROM creators WHERE username = '${username}'`);

// ALWAYS use transactions for multiple operations
// ✅ CORRECT
const insertCreatorWithVideos = db.transaction((creator, videos) => {
  const creatorStmt = db.prepare('INSERT INTO creators ...');
  const videoStmt = db.prepare('INSERT INTO videos ...');
  
  const creatorResult = creatorStmt.run(creator);
  videos.forEach(video => videoStmt.run({ ...video, creatorId: creatorResult.lastInsertRowid }));
});

// ALWAYS handle database errors
try {
  const result = await dbService.query(sql, params);
  return result;
} catch (error) {
  logger.error('Database query failed', { error, sql, params });
  throw new DatabaseError('Query execution failed', { cause: error });
}
```

### **Migration Rules**

```typescript
// migrations/001_initial_schema.sql
-- ALWAYS include IF NOT EXISTS
CREATE TABLE IF NOT EXISTS creators (
  -- ALWAYS use INTEGER PRIMARY KEY for SQLite
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- ALWAYS add NOT NULL for required fields
  username TEXT UNIQUE NOT NULL,
  -- ALWAYS include timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ALWAYS create indexes for foreign keys and frequently queried columns
CREATE INDEX IF NOT EXISTS idx_creators_username ON creators(username);
```

## 🎨 UI/UX Standards

### **Material-UI Theming**

```typescript
// theme/index.ts - ALWAYS define a consistent theme
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#E1306C',      // Instagram pink
      light: '#F77097',
      dark: '#C1265A',
    },
    secondary: {
      main: '#405DE6',      // Instagram blue
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,       // Consistent border radius
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',  // No uppercase transformation
          fontWeight: 600,
        },
      },
    },
  },
});

// ALWAYS use theme values, never hardcode
// ✅ CORRECT
<Box sx={{ 
  bgcolor: 'background.paper',
  color: 'primary.main',
  borderRadius: 1  // Uses theme.shape.borderRadius * 1
}}>

// ❌ WRONG
<Box sx={{ 
  bgcolor: '#FFFFFF',
  color: '#E1306C',
  borderRadius: '12px'
}}>
```

### **Responsive Design Rules**

```typescript
// ALWAYS use responsive values
<Grid container spacing={{ xs: 2, md: 3 }}>
  <Grid item xs={12} md={6} lg={4}>
    {/* Content */}
  </Grid>
</Grid>

// ALWAYS use breakpoint utilities
<Box sx={{
  display: { xs: 'none', md: 'block' },
  p: { xs: 2, sm: 3, md: 4 }
}}>
```

## 🔒 Security Requirements

### **IPC Communication**

```typescript
// main/preload.js - ALWAYS use contextBridge
import { contextBridge, ipcRenderer } from 'electron';

// ✅ CORRECT - Expose limited, safe API
contextBridge.exposeInMainWorld('electronAPI', {
  // Whitelist specific channels
  getCreators: () => ipcRenderer.invoke('db:get-creators'),
  addCreator: (data) => ipcRenderer.invoke('db:add-creator', data),
  
  // NEVER expose ipcRenderer directly
  // ❌ WRONG
  // ipcRenderer: ipcRenderer
});

// main/ipc-handlers.js - ALWAYS validate inputs
ipcMain.handle('db:add-creator', async (event, data) => {
  // Validate input
  const schema = Joi.object({
    username: Joi.string().alphanum().min(1).max(30).required(),
    displayName: Joi.string().max(100)
  });
  
  const { error, value } = schema.validate(data);
  if (error) {
    throw new ValidationError(error.message);
  }
  
  return await dbService.addCreator(value);
});
```

### **Data Sanitization**

```typescript
// ALWAYS sanitize user inputs
import DOMPurify from 'isomorphic-dompurify';

// For HTML content
const sanitizedHtml = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
  ALLOWED_ATTR: []
});

// For SQL queries - ALWAYS use parameterized queries
// NEVER concatenate strings for SQL

// For file paths - ALWAYS validate
import { join, normalize } from 'path';

const safePath = normalize(userPath);
if (!safePath.startsWith(ALLOWED_BASE_PATH)) {
  throw new SecurityError('Invalid path');
}
```

## 🧪 Testing Standards

### **Test Structure**

```typescript
// ✅ CORRECT test structure
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('CreatorCard', () => {
  // Setup and teardown
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  // Group related tests
  describe('rendering', () => {
    it('should display creator username', () => {
      // Arrange
      const creator = { id: 1, username: 'testuser' };
      
      // Act
      render(<CreatorCard creator={creator} />);
      
      // Assert
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });
  
  describe('interactions', () => {
    it('should call onSelect when clicked', async () => {
      // ALWAYS use userEvent for interactions
      const user = userEvent.setup();
      const onSelect = vi.fn();
      
      render(<CreatorCard creator={creator} onSelect={onSelect} />);
      
      await user.click(screen.getByRole('button'));
      
      expect(onSelect).toHaveBeenCalledWith(creator);
    });
  });
  
  // ALWAYS test error states
  describe('error handling', () => {
    it('should display error message when loading fails', async () => {
      // Test implementation
    });
  });
});
```

### **Mock Data Patterns**

```typescript
// test-utils/factories.ts
// ALWAYS use factories for test data
export const createMockCreator = (overrides = {}): Creator => ({
  id: 1,
  username: 'testuser',
  displayName: 'Test User',
  followerCount: 1000,
  isVerified: false,
  ...overrides
});

// NEVER hardcode test data in tests
// ✅ CORRECT
const creator = createMockCreator({ followerCount: 5000 });

// ❌ WRONG
const creator = { id: 1, username: 'test', ... };
```

## 📊 Performance Guidelines

### **React Optimization**

```typescript
// ALWAYS memoize expensive computations
const expensiveValue = useMemo(() => 
  heavyComputation(data),
  [data] // Proper dependencies
);

// ALWAYS memoize callbacks passed to children
const handleClick = useCallback((id: number) => {
  dispatch(selectCreator(id));
}, [dispatch]);

// ALWAYS use React.memo for pure components
export const CreatorCard = React.memo<Props>(({ creator, onSelect }) => {
  // Component implementation
});

// ALWAYS virtualize long lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={80}
  width="100%"
>
  {Row}
</FixedSizeList>
```

### **Database Optimization**

```typescript
// ALWAYS prepare statements for repeated queries
class DatabaseService {
  private statements = new Map<string, Statement>();
  
  constructor() {
    this.prepareStatements();
  }
  
  private prepareStatements() {
    this.statements.set(
      'getCreator',
      this.db.prepare('SELECT * FROM creators WHERE id = ?')
    );
  }
  
  getCreator(id: number) {
    return this.statements.get('getCreator')!.get(id);
  }
}

// ALWAYS use indexes for frequently queried columns
// ALWAYS batch operations when possible
// ALWAYS use PRAGMA optimizations
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
```

## 🚨 Error Handling

### **Error Classes**

```typescript
// ALWAYS use custom error classes
export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ScrapingError extends Error {
  constructor(
    message: string, 
    public readonly retryable: boolean = true,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ScrapingError';
  }
}
```

### **Error Handling Patterns**

```typescript
// ALWAYS handle errors at appropriate levels
// Service layer - throw specific errors
async scrapeProfile(username: string): Promise<Profile> {
  try {
    const result = await this.puppeteer.scrape(username);
    return result;
  } catch (error) {
    if (error.message.includes('rate limit')) {
      throw new ScrapingError('Rate limited', true, error);
    }
    throw new ScrapingError('Scraping failed', false, error);
  }
}

// Component layer - handle and display errors
const handleRefresh = async () => {
  try {
    await refreshData();
  } catch (error) {
    if (error instanceof ScrapingError && error.retryable) {
      // Show retry option
      showNotification({
        message: 'Temporarily unavailable. Retry?',
        action: handleRefresh
      });
    } else {
      // Show error message
      showError(error.message);
    }
  }
};
```

## 📝 Documentation Standards

### **Code Documentation**

```typescript
/**
 * Service for managing Instagram creator data
 * @class DatabaseService
 * @example
 * const db = new DatabaseService('./data.db');
 * const creator = await db.getCreator(1);
 */
export class DatabaseService {
  /**
   * Retrieves creator by ID
   * @param {number} id - Creator database ID
   * @returns {Promise<Creator>} Creator object
   * @throws {DatabaseError} If creator not found
   * @example
   * const creator = await db.getCreator(123);
   */
  async getCreator(id: number): Promise<Creator> {
    // Implementation
  }
}

// ALWAYS include JSDoc for:
// - Public classes and methods
// - Complex algorithms
// - Non-obvious implementations
// - External API interfaces
```

### **README Sections**

```markdown
# ALWAYS include these sections in README.md

## Prerequisites
- Node.js >= 18.0.0
- Windows 10/11 (64-bit)
- 4GB RAM minimum

## Installation
\`\`\`bash
npm install
npm run dev
\`\`\`

## Configuration
Create `.env` file with required variables

## Architecture
Brief description with diagram

## API Documentation
Link to detailed API docs

## Troubleshooting
Common issues and solutions

## Contributing
Guidelines for contributors

## License
MIT
```

## 🛑 Anti-Patterns to Avoid

### **Code Anti-Patterns**

```typescript
// ❌ NEVER use any without explicit justification
const data: any = fetchData();  // WRONG

// ❌ NEVER ignore Promise rejections
asyncFunction();  // WRONG - unhandled rejection

// ❌ NEVER mutate state directly
state.items.push(newItem);  // WRONG in React

// ❌ NEVER use == for comparison
if (value == null)  // WRONG - use ===

// ❌ NEVER leave console.logs
console.log('debug', data);  // WRONG in production

// ❌ NEVER use magic numbers
if (count > 10)  // WRONG - use constants

// ❌ NEVER mix concerns
// Component doing data fetching, business logic, and rendering
```

### **Architecture Anti-Patterns**

```typescript
// ❌ NEVER put business logic in components
// ❌ NEVER access database directly from renderer process  
// ❌ NEVER store sensitive data in localStorage
// ❌ NEVER use synchronous IPC calls
// ❌ NEVER bypass TypeScript with @ts-ignore
// ❌ NEVER create circular dependencies
// ❌ NEVER use global variables for state
```

## 🎯 Code Generation Checklist

When generating code, ALWAYS verify:

- [ ] TypeScript types are properly defined
- [ ] Error handling is comprehensive
- [ ] Loading states are implemented
- [ ] Input validation is present
- [ ] Security considerations are addressed
- [ ] Performance optimizations are applied
- [ ] Code is properly documented
- [ ] Tests are included or outlined
- [ ] Accessibility requirements are met
- [ ] Memory leaks are prevented

## 📚 Reference Resources

### **Priority Documentation**
1. [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
2. [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
3. [Material-UI Component Demos](https://mui.com/material-ui/all-components/)
4. [Better-SQLite3 API](https://github.com/WiseLibs/better-sqlite3/wiki/API)
5. [Puppeteer API](https://pptr.dev/api)

### **Design System References**
- Material Design 3 Guidelines
- Instagram Brand Resources
- Windows 11 Design Principles

## 🔄 Version Control Guidelines

### **Commit Message Format**

```bash
# ALWAYS use conventional commits
feat: add creator analytics dashboard
fix: resolve memory leak in scraper
docs: update API documentation
test: add unit tests for database service
refactor: optimize metrics calculation
perf: improve dashboard rendering speed
chore: update dependencies
```

### **Branch Naming**

```bash
feature/add-export-functionality
bugfix/fix-scraper-timeout
hotfix/critical-security-patch
refactor/optimize-database-queries
```

## 🚀 Deployment Checklist

Before deployment, ENSURE:

- [ ] All tests pass (unit, integration, e2e)
- [ ] No console.log statements remain
- [ ] Environment variables are documented
- [ ] Security audit is clean
- [ ] Performance benchmarks are met
- [ ] Error tracking is configured
- [ ] Analytics are implemented
- [ ] Documentation is updated
- [ ] Version numbers are incremented
- [ ] Release notes are prepared

---

**Remember**: When in doubt, prioritize security > reliability > performance > features. Always validate inputs, handle errors gracefully, and write code that is maintainable by others.