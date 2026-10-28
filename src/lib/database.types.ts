
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "concesiones": {
                  Row: {
                    "activa": boolean,"actualizado_en": string,"id": number,"kam_id": string | null,"nombre_comercial": string | null,"razon_social": string,"territorio_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"actualizado_en"?: string,"id": number,"kam_id"?: string | null,"nombre_comercial"?: string | null,"razon_social": string,"territorio_id"?: number | null
                  }
                  Update: {
                    "activa"?: boolean,"actualizado_en"?: string,"id"?: number,"kam_id"?: string | null,"nombre_comercial"?: string | null,"razon_social"?: string,"territorio_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "concesiones_kam_id_fkey"
      columns: ["kam_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "concesiones_territorio_id_fkey"
      columns: ["territorio_id"]
isOneToOne: false
      referencedRelation: "territorios"
      referencedColumns: ["id"]
    }
                  ]
                },"perfiles": {
                  Row: {
                    "activo": boolean,"email": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_usuario"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"email": string,"id"?: string,"nombre": string,"rol": Database["public"]['Enums']["rol_usuario"],"user_id"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"email"?: string,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_usuario"],"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"permisos_extra": {
                  Row: {
                    "caduca": string | null,"concesion_id": number | null,"espacio": Database["public"]['Enums']["espacio"] | null,"id": string,"perfil_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caduca"?: string | null,"concesion_id"?: number | null,"espacio"?: Database["public"]['Enums']["espacio"] | null,"id"?: string,"perfil_id": string
                  }
                  Update: {
                    "caduca"?: string | null,"concesion_id"?: number | null,"espacio"?: Database["public"]['Enums']["espacio"] | null,"id"?: string,"perfil_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "permisos_extra_concesion_id_fkey"
      columns: ["concesion_id"]
isOneToOne: false
      referencedRelation: "concesiones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permisos_extra_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"territorios": {
                  Row: {
                    "id": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"nombre": string
                  }
                  Update: {
                    "id"?: number,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "es_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"es_interno":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mi_perfil":
{ Args: Record<PropertyKey, never>; Returns: {
              "activo": boolean,
"email": string,
"id": string,
"nombre": string,
"rol": Database["public"]['Enums']["rol_usuario"],
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "perfiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"puede_editar_concesion":
{ Args: { "p_concesion": number,"p_espacio": Database["public"]['Enums']["espacio"] }; Returns: boolean
                           }
          }
          Enums: {
            "espacio": "TMICC"|"UFS"|"CAMPANAS","marca": "TMICC"|"UFS","rol_usuario": "admin"|"kam"|"socio"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "espacio": ["TMICC", "UFS", "CAMPANAS"],"marca": ["TMICC", "UFS"],"rol_usuario": ["admin", "kam", "socio"]
          }
        }
} as const
