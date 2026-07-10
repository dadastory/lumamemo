import { formatPhotoLocation } from '~/utils/photo-location'

interface FilterOptions {
  tags: string[]
  cameras: string[]
  lenses: string[]
  cities: string[]
  people: number[]
  ratings: number // 改为单个数字，表示最低评分
  search: string // 搜索关键词
  advancedSearch: boolean
}

interface FilterStats {
  tags: Map<string, number>
  cameras: Map<string, number>
  lenses: Map<string, number>
  cities: Map<string, number>
  ratings: Map<number, number>
}

interface PersonFilterOption {
  id: number
  label?: string
  name?: string | null
  count: number
  faceCount?: number
}

interface SemanticSearchResponse {
  query: string
  results?: Array<{ id: string }>
  degraded?: boolean
  reason?: 'semantic-unavailable'
}

// 全局筛选状态管理
const globalFilters = ref<FilterOptions>({
  tags: [],
  cameras: [],
  lenses: [],
  cities: [],
  people: [],
  ratings: 0,
  search: '',
  advancedSearch: false,
})

const semanticResultIds = ref<Set<string> | null>(null)
const semanticLoading = ref(false)
const semanticError = ref<string | null>(null)
const peopleFilters = ref<PersonFilterOption[]>([])
const SEMANTIC_SEARCH_LIMIT = 30

export function usePhotoFilters() {
  const { photos } = usePhotos()
  const { sortedPhotos } = usePhotoSort()
  const route = useRoute()
  const { t } = useI18n()

  // 使用全局筛选状态
  const activeFilters = globalFilters

  // 计算可用的筛选选项及其数量
  const filterStats = computed((): FilterStats => {
    const stats: FilterStats = {
      tags: new Map(),
      cameras: new Map(),
      lenses: new Map(),
      cities: new Map(),
      ratings: new Map(),
    }

    photos.value.forEach((photo) => {
      // 标签统计
      if (photo.tags && Array.isArray(photo.tags)) {
        photo.tags.forEach((tag) => {
          stats.tags.set(tag, (stats.tags.get(tag) || 0) + 1)
        })
      }

      // 相机统计 (从 EXIF 获取)
      if (photo.exif?.Make && photo.exif?.Model) {
        const camera = `${photo.exif.Make} ${photo.exif.Model}`
        stats.cameras.set(camera, (stats.cameras.get(camera) || 0) + 1)
      }

      // 镜头统计 (从 EXIF 获取)
      if (photo.exif?.LensMake && photo.exif?.LensModel) {
        const lens = `${photo.exif.LensMake} ${photo.exif.LensModel}`
        stats.lenses.set(lens, (stats.lenses.get(lens) || 0) + 1)
      } else if (photo.exif?.LensModel) {
        const lens = photo.exif.LensModel
        stats.lenses.set(lens, (stats.lenses.get(lens) || 0) + 1)
      }

      // 位置统计。内部状态仍沿用 cities，避免影响已有筛选状态。
      const photoLocation = formatPhotoLocation(photo)
      if (photoLocation) {
        stats.cities.set(
          photoLocation,
          (stats.cities.get(photoLocation) || 0) + 1,
        )
      }

      // 评分统计 (从 EXIF Rating 获取)
      if (photo.exif?.Rating && photo.exif.Rating > 0) {
        const rating = photo.exif.Rating
        stats.ratings.set(rating, (stats.ratings.get(rating) || 0) + 1)
      }
    })

    return stats
  })

  // 获取排序后的筛选选项
  const availableFilters = computed(() => {
    return {
      tags: Array.from(filterStats.value.tags.entries())
        .sort((a, b) => b[1] - a[1]) // 按数量降序排列
        .map(([tag, count]) => ({ label: tag, count })),

      cameras: Array.from(filterStats.value.cameras.entries())
        .sort((a, b) => a[0].localeCompare(b[0])) // 按名称字母顺序排列
        .map(([camera, count]) => ({ label: camera, count })),

      lenses: Array.from(filterStats.value.lenses.entries())
        .sort((a, b) => a[0].localeCompare(b[0])) // 按名称字母顺序排列
        .map(([lens, count]) => ({ label: lens, count })),

      cities: Array.from(filterStats.value.cities.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([city, count]) => ({ label: city, count })),

      ratings: Array.from(filterStats.value.ratings.entries())
        .sort((a, b) => b[0] - a[0]) // 按评分降序排列
        .map(([rating, count]) => ({ label: rating, count })),

      people: peopleFilters.value,
    }
  })

  // 计算已选择的筛选项数量
  const selectedCounts = computed(() => {
    return {
      tags: activeFilters.value.tags.length,
      cameras: activeFilters.value.cameras.length,
      lenses: activeFilters.value.lenses.length,
      cities: activeFilters.value.cities.length,
      people: activeFilters.value.people.length,
      ratings: activeFilters.value.ratings > 0 ? 1 : 0,
      search: activeFilters.value.search.length > 0 ? 1 : 0,
    }
  })

  const keywordSearchMatches = (photo: any, rawTerm: string) => {
    const searchTerm = rawTerm.trim().toLowerCase()
    if (!searchTerm) return true

    const fileName = String(photo.storageKey || '').split('/').pop() || ''
    const searchableFields = [
      photo.tags?.join(' ') || '',
      fileName,
    ]
      .join(' ')
      .toLowerCase()

    return searchableFields.includes(searchTerm)
  }

  // 筛选后的照片（应用排序）
  const filteredPhotos = computed(() => {
    // 先获取排序后的照片，再应用筛选
    return sortedPhotos.value.filter((photo) => {
      // 搜索筛选
      if (activeFilters.value.search) {
        const keywordMatch = keywordSearchMatches(
          photo,
          activeFilters.value.search,
        )
        const semanticMatch =
          activeFilters.value.advancedSearch &&
          (semanticResultIds.value?.has(photo.id) || false)
        if (!keywordMatch && !semanticMatch) {
          return false
        }
      }

      // 标签筛选
      if (activeFilters.value.tags.length > 0) {
        const photoTags = photo.tags || []
        const hasMatchingTag = activeFilters.value.tags.some((tag) =>
          photoTags.includes(tag),
        )
        if (!hasMatchingTag) return false
      }

      // 相机筛选
      if (activeFilters.value.cameras.length > 0) {
        const photoCamera =
          photo.exif?.Make && photo.exif?.Model
            ? `${photo.exif.Make} ${photo.exif.Model}`
            : null
        if (
          !photoCamera ||
          !activeFilters.value.cameras.includes(photoCamera)
        ) {
          return false
        }
      }

      // 镜头筛选
      if (activeFilters.value.lenses.length > 0) {
        const photoLens =
          photo.exif?.LensMake && photo.exif?.LensModel
            ? `${photo.exif.LensMake} ${photo.exif.LensModel}`
            : photo.exif?.LensModel || null
        if (!photoLens || !activeFilters.value.lenses.includes(photoLens)) {
          return false
        }
      }

      // 位置筛选。内部状态仍沿用 cities，避免影响已有筛选状态。
      if (activeFilters.value.cities.length > 0) {
        const photoLocation = formatPhotoLocation(photo)
        if (
          !photoLocation ||
          !activeFilters.value.cities.includes(photoLocation)
        ) {
          return false
        }
      }

      if (activeFilters.value.people.length > 0) {
        const photoFaces = (photo as any).photoFaces
        const personIds = Array.isArray(photoFaces)
          ? photoFaces
              .map((face: any) => Number(face.personId))
              .filter(Number.isFinite)
          : []
        if (
          !activeFilters.value.people.some((personId) =>
            personIds.includes(personId),
          )
        ) {
          return false
        }
      }

      // 评分筛选
      if (activeFilters.value.ratings > 0) {
        const photoRating = photo.exif?.Rating || 0
        if (photoRating < activeFilters.value.ratings) {
          return false
        }
      }

      return true
    })
  })

  // 切换筛选项
  const toggleFilter = (type: keyof FilterOptions, value: string | number) => {
    const filters = activeFilters.value[type] as any[]
    const index = filters.indexOf(value)

    if (index === -1) {
      filters.push(value)
    } else {
      filters.splice(index, 1)
    }
  }

  // 清除所有筛选
  const clearAllFilters = () => {
    activeFilters.value = {
      tags: [],
      cameras: [],
      lenses: [],
      cities: [],
      people: [],
      ratings: 0,
      search: '',
      advancedSearch: false,
    }
    semanticResultIds.value = null
    semanticError.value = null
  }

  // 清除指定类型的筛选
  const clearFilterType = (type: keyof FilterOptions) => {
    if (type === 'ratings' || type === 'search') {
      ;(activeFilters.value as any)[type] = type === 'ratings' ? 0 : ''
      if (type === 'search') {
        semanticResultIds.value = null
        semanticError.value = null
        activeFilters.value.advancedSearch = false
      }
    } else {
      ;(activeFilters.value as any)[type] = []
    }
  }

  // 检查筛选项是否被选中
  const isFilterSelected = (
    type: keyof FilterOptions,
    value: string | number,
  ) => {
    return (activeFilters.value[type] as any[]).includes(value)
  }

  // 检查是否有任何筛选项被激活
  const hasActiveFilters = computed(() => {
    return (
      activeFilters.value.tags.length > 0 ||
      activeFilters.value.cameras.length > 0 ||
      activeFilters.value.lenses.length > 0 ||
      activeFilters.value.cities.length > 0 ||
      activeFilters.value.people.length > 0 ||
      activeFilters.value.ratings > 0 ||
      activeFilters.value.search.length > 0
    )
  })

  const getPublicProfileId = () => {
    const segments = route.path.split('/').filter(Boolean)
    return segments[0] === 'u' ? segments[1] : null
  }

  const semanticSearch = async () => {
    const query = activeFilters.value.search.trim()
    semanticError.value = null
    semanticResultIds.value = null
    if (!query) return
    if (!activeFilters.value.advancedSearch) {
      semanticResultIds.value = null
      semanticError.value = null
      return
    }

    semanticLoading.value = true
    try {
      const publicId = getPublicProfileId()
      const response = await $fetch<SemanticSearchResponse>(
        publicId
          ? `/api/public/profiles/${encodeURIComponent(publicId)}/photos/search/semantic`
          : '/api/photos/search/semantic',
        {
          query: {
            q: query,
            limit: SEMANTIC_SEARCH_LIMIT,
          },
        },
      )
      if (response.degraded) {
        semanticError.value = t('ui.action.filter.semanticSearchDegraded')
        semanticResultIds.value = null
        return
      }

      semanticResultIds.value = new Set(
        (response.results || []).map((photo) => photo.id).filter(Boolean),
      )
    } catch {
      semanticError.value = t('ui.action.filter.semanticSearchDegraded')
      semanticResultIds.value = null
    } finally {
      semanticLoading.value = false
    }
  }

  const smartSearch = async () => {
    activeFilters.value.advancedSearch = true
    await semanticSearch()
  }

  const loadPeopleFilters = async () => {
    try {
      const people = await $fetch<PersonFilterOption[]>('/api/people', {
        query: { includeHidden: false },
      })
      peopleFilters.value = people.map((person) => ({
        id: person.id,
        label: person.label || person.name || `Person ${person.id}`,
        count: person.count ?? (person as any).faceCount ?? 0,
      }))
    } catch {
      peopleFilters.value = []
    }
  }

  return {
    activeFilters: activeFilters,
    availableFilters,
    selectedCounts,
    filteredPhotos,
    hasActiveFilters,
    semanticResultIds,
    semanticLoading,
    semanticError,
    semanticSearch,
    smartSearch,
    advancedSearchEnabled: computed({
      get: () => activeFilters.value.advancedSearch,
      set: (enabled: boolean) => {
        activeFilters.value.advancedSearch = enabled
        if (!enabled) {
          semanticResultIds.value = null
          semanticError.value = null
        }
      },
    }),
    keywordSearchMatches,
    loadPeopleFilters,
    toggleFilter,
    clearAllFilters,
    clearFilterType,
    isFilterSelected,
  }
}
