# Dashboard Progressive Loading Implementation

This directory contains the implementation of a progressive loading system for the Songmetrix dashboard, designed to improve user experience by loading data in priority order.

## Components

### Core Components

- **`DashboardProgressive.tsx`** - Main dashboard component with progressive loading
- **`DashboardSkeletons.tsx`** - Skeleton loading components for different sections
- **`index.tsx`** - Original dashboard component (preserved for comparison)

### Supporting Files

- **`README.md`** - This documentation
- **`DashboardProgressive.test.tsx`** - Tests for the progressive loading system

## Progressive Loading System

### Architecture

The progressive loading system divides dashboard data into three priority levels:

1. **Essential (0-500ms)**: User info, basic metrics, active radios
2. **Secondary (500ms-2s)**: Top songs, artist data
3. **Optional (2s+)**: Genre distribution, detailed charts

### API Endpoints

The system uses dedicated API endpoints for each priority level:

- `GET /api/dashboard/essential` - Essential data (metrics, radio count)
- `GET /api/dashboard/secondary` - Secondary data (songs, artists)
- `GET /api/dashboard/optional` - Optional data (genre distribution)

### Loading States

Each section has its own loading state with skeleton components:

- **MetricsRowSkeleton** - For the metrics cards
- **TopSongsSkeleton** - For the songs list
- **RadioListSkeleton** - For the radios list
- **ArtistChartSkeleton** - For the artist bar chart
- **GenreChartSkeleton** - For the genre pie chart

### Usage

```tsx
import DashboardProgressive from './components/Dashboard/DashboardProgressive';

// Use instead of the original Dashboard component
<DashboardProgressive />
```

### Features

- **Priority-based loading**: Data loads in order of importance
- **Skeleton components**: Smooth loading transitions
- **Error handling**: Graceful degradation when sections fail
- **Progress indication**: Visual feedback on loading progress
- **Retry mechanism**: Ability to retry failed sections
- **Responsive design**: Works on all screen sizes

### Performance Benefits

- **Faster initial load**: Essential data appears first
- **Better perceived performance**: Skeleton loading reduces perceived wait time
- **Reduced blocking**: Secondary data doesn't block essential data
- **Improved UX**: Users see content progressively instead of waiting for everything

### Configuration

The progressive loading system can be configured through the `ProgressiveLoadingConfig`:

```tsx
const config = {
  sections: [
    {
      id: 'essential',
      priority: 'essential',
      name: 'Dados Essenciais',
      fetchFn: fetchEssentialData
    },
    // ... more sections
  ],
  onSectionComplete: (sectionId, data) => {
    // Handle section completion
  },
  onSectionError: (sectionId, error) => {
    // Handle section errors
  }
};
```

### Testing

Run tests with:

```bash
npm test DashboardProgressive.test.tsx
```

### Migration from Original Dashboard

To migrate from the original dashboard:

1. Replace `Dashboard` import with `DashboardProgressive`
2. Ensure API endpoints are available
3. Update any custom styling if needed
4. Test the progressive loading behavior

### Browser Support

- Modern browsers with ES2017+ support
- React 18+ with Suspense support
- Intersection Observer API (for lazy loading)

### Dependencies

- React 18+
- @tanstack/react-query (for caching)
- Recharts (for charts)
- Lucide React (for icons)
- Tailwind CSS (for styling)