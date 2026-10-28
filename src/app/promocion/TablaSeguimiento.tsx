import { useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type CellEditRequestEvent,
  type ColDef,
  type ICellRendererParams,
} from 'ag-grid-community'
import { ETIQUETA_ENVIO, ETIQUETA_ESTADO } from '../../dominio/etiquetas'
import { nivelAlertaCupos, pctCupos } from '../../dominio/calculos'
import {
  claseCelda,
  esEditable,
  isoALocal,
  localAIso,
  textoFechaHora,
  textoGsvUso,
  textoPctCupos,
  type CampoEditable,
  type CampoGrid,
} from './celdas'
import type { FilaGrid } from './servicio'

ModuleRegistry.registerModules([AllCommunityModule])

const tema = themeQuartz.withParams({
  accentColor: '#1f4e79',
  fontSize: 13,
  rowHeight: 34,
  headerHeight: 36,
  headerBackgroundColor: '#f6f7f9',
  borderColor: '#d9dee5',
})

export interface PropsTabla {
  filas: FilaGrid[]
  /** concesion_id de las filas que el usuario puede editar. */
  editables: Set<number>
  esAdmin: boolean
  umbral: number
  onEditar: (fila: FilaGrid, campo: CampoEditable, valor: unknown) => void
  onSeleccion: (ids: string[]) => void
  onAbrirFicha: (id: string) => void
  /** Cada cambio de este contador deselecciona todas las filas. */
  limpiarSeleccion?: number
  /** Desactiva la virtualización para poder probar en jsdom. */
  pruebas?: boolean
}

const fmtEntero = (v: number | null) => (v == null ? '—' : v.toLocaleString('es-ES'))
const fmtEuro = (v: number | null) =>
  v == null ? '—' : Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default function TablaSeguimiento({
  filas,
  editables,
  esAdmin,
  umbral,
  onEditar,
  onSeleccion,
  onAbrirFicha,
  limpiarSeleccion,
  pruebas,
}: PropsTabla) {
  const grid = useRef<AgGridReact<FilaGrid>>(null)
  useEffect(() => {
    grid.current?.api?.deselectAll()
  }, [limpiarSeleccion])

  const columnas = useMemo<ColDef<FilaGrid>[]>(() => {
    const ctx = (f: FilaGrid) => ({ editable: editables.has(f.concesion_id), esAdmin, umbral })
    const clase = (campo: CampoGrid) => (p: { data?: FilaGrid }) =>
      p.data ? claseCelda(campo, p.data, ctx(p.data)) : ''
    const editable = (campo: CampoGrid) => (p: { data?: FilaGrid }) => !!p.data && esEditable(campo, ctx(p.data))

    const seleccion = (
      campo: CampoEditable,
      titulo: string,
      etiquetas: Record<string, string>,
      ancho: number,
    ): ColDef<FilaGrid> => ({
      colId: campo,
      field: campo,
      headerName: titulo,
      width: ancho,
      editable: editable(campo),
      cellClass: clase(campo),
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: Object.keys(etiquetas), useFormatter: true },
      valueFormatter: (p) => etiquetas[p.value as string] ?? '—',
    })

    const numero = (campo: CampoEditable, titulo: string, formato: (v: number | null) => string): ColDef<FilaGrid> => ({
      colId: campo,
      field: campo,
      headerName: titulo,
      type: 'rightAligned',
      width: 110,
      editable: editable(campo),
      cellClass: clase(campo),
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: campo === 'gsv' ? 2 : 0 },
      valueFormatter: (p) => formato(p.value as number | null),
    })

    const fecha = (campo: 'fecha_aceptacion' | 'fecha_activacion', titulo: string): ColDef<FilaGrid> => ({
      colId: campo,
      headerName: titulo,
      width: 160,
      editable: editable(campo),
      cellClass: clase(campo),
      // Sin cellDataType el editor devolvería solo la fecha y perdería la hora.
      cellDataType: 'dateTimeString',
      cellEditor: 'agDateStringCellEditor',
      cellEditorParams: { includeTime: true },
      valueGetter: (p) => isoALocal(p.data?.[campo] ?? null),
      valueFormatter: (p) => textoFechaHora(localAIso((p.value as string | null) ?? null)),
    })

    return [
      {
        colId: 'concesion',
        headerName: 'Concesión',
        field: 'nombre',
        pinned: 'left',
        width: 240,
        cellRenderer: (p: ICellRendererParams<FilaGrid>) =>
          p.data ? (
            <button type="button" className="enlace" onClick={() => onAbrirFicha(p.data!.id)}>
              {p.data.nombre}
            </button>
          ) : null,
      },
      { colId: 'num', headerName: 'Nº', field: 'concesion_id', width: 80, type: 'rightAligned' },
      { colId: 'kam', headerName: 'KAM', field: 'kam_nombre', width: 130, valueFormatter: (p) => p.value ?? '—' },
      { colId: 'territorio', headerName: 'Territorio', field: 'territorio', width: 110, valueFormatter: (p) => p.value ?? '—' },
      seleccion('estado', 'Estado', ETIQUETA_ESTADO, 130),
      fecha('fecha_aceptacion', 'F. aceptación'),
      fecha('fecha_activacion', 'F. activación'),
      numero('cupos', 'Cupos', fmtEntero),
      numero('usos', 'Usos', fmtEntero),
      numero('gsv', 'GSV', fmtEuro),
      {
        colId: 'pct_cupos',
        headerName: '% Cupos',
        type: 'rightAligned',
        width: 110,
        cellClass: clase('pct_cupos'),
        valueGetter: (p) => (p.data ? pctCupos(p.data.usos, p.data.cupos) : null),
        valueFormatter: (p) => (p.data ? textoPctCupos(p.data.usos, p.data.cupos) : ''),
        cellRenderer: (p: ICellRendererParams<FilaGrid>) =>
          p.data ? (
            <>
              {nivelAlertaCupos(p.data.usos, p.data.cupos, umbral) === 'agotado' ? '⚠ ' : ''}
              {textoPctCupos(p.data.usos, p.data.cupos)}
            </>
          ) : null,
      },
      {
        colId: 'gsv_uso',
        headerName: 'GSV/uso',
        type: 'rightAligned',
        width: 110,
        valueGetter: (p) => (p.data && p.data.usos ? Number(p.data.gsv ?? 0) / p.data.usos : null),
        valueFormatter: (p) => (p.data ? textoGsvUso(p.data.gsv, p.data.usos) : ''),
      },
      seleccion('sms', 'SMS', ETIQUETA_ENVIO, 110),
      seleccion('email', 'Email', ETIQUETA_ENVIO, 110),
    ]
  }, [editables, esAdmin, umbral, onAbrirFicha])

  function alEditar(e: CellEditRequestEvent<FilaGrid>) {
    const campo = e.colDef.colId as CampoEditable
    const esFecha = campo === 'fecha_aceptacion' || campo === 'fecha_activacion'
    const valor = esFecha ? localAIso(e.newValue as string | null) : e.newValue
    if (e.data) onEditar(e.data, campo, valor)
  }

  return (
    <div className={pruebas ? undefined : 'tabla-grid'}>
      <AgGridReact<FilaGrid>
        ref={grid}
        theme={tema}
        rowData={filas}
        columnDefs={columnas}
        getRowId={(p) => p.data.id}
        readOnlyEdit
        onCellEditRequest={alEditar}
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        enterNavigatesVertically
        enterNavigatesVerticallyAfterEdit
        rowSelection={{ mode: 'multiRow', enableClickSelection: false }}
        onSelectionChanged={(e) => onSeleccion(e.api.getSelectedRows().map((f) => f.id))}
        defaultColDef={{ sortable: true, resizable: true }}
        suppressRowVirtualisation={pruebas}
        suppressColumnVirtualisation={pruebas}
        animateRows={!pruebas}
        domLayout={pruebas ? 'autoHeight' : 'normal'}
      />
    </div>
  )
}
