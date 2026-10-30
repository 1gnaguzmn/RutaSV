import type { GeoJSONSource } from 'maplibre-gl'
import { STOP_CLUSTER_MAX_ZOOM } from './layerStyles.ts'

interface ClusterRequest {
  source: Pick<GeoJSONSource, 'getClusterExpansionZoom' | 'getClusterLeaves'>
  clusterId: number
  pointCount: number
  knownStopIds: ReadonlySet<string>
  onExpand: (zoom: number) => void
  onGroup: (ids: string[]) => void
  onError: () => void
}

export class ClusterInteraction {
  private revision = 0

  invalidate() { this.revision += 1 }

  async open(request: ClusterRequest): Promise<void> {
    const revision = ++this.revision
    try {
      const zoom = await request.source.getClusterExpansionZoom(request.clusterId)
      if (revision !== this.revision) return
      if (!Number.isFinite(zoom)) throw new Error('Zoom de agrupación inválido')
      if (zoom <= STOP_CLUSTER_MAX_ZOOM) {
        request.onExpand(zoom)
        return
      }
      const leaves = await request.source.getClusterLeaves(request.clusterId, request.pointCount, 0)
      if (revision !== this.revision) return
      const ids = leaves.map((leaf) => leaf.properties?.id as unknown)
      if (!Number.isInteger(request.pointCount) || request.pointCount < 1 || ids.length !== request.pointCount ||
        ids.some((id) => typeof id !== 'string' || !request.knownStopIds.has(id)) || new Set(ids).size !== ids.length) {
        throw new Error('Registros de agrupación incompletos o desconocidos')
      }
      request.onGroup(ids as string[])
    } catch {
      if (revision === this.revision) request.onError()
    }
  }
}
