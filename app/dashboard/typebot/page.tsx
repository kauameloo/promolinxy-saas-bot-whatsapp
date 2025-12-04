// =====================================================
// TYPEBOT PAGE - TypeBot Flow Management
// =====================================================

"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { useApi, apiPost, apiPut, apiDelete } from "@/lib/hooks/use-api"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Bot, Settings, Trash2, TestTube, Loader2, ExternalLink, Eye } from "lucide-react"
import { mutate } from "swr"
import { toast } from "sonner"

interface TypeBotFlow {
  id: string
  tenant_id: string
  name: string
  flow_url: string
  token?: string
  is_active: boolean
  settings: {
    preferReupload?: boolean
    enableUrlRewrite?: boolean
    urlRewriteMap?: Record<string, string>
    delays?: {
      fixed?: number
      perMessage?: number
      random?: { min: number; max: number }
    }
  }
  created_at: string
  updated_at: string
}

interface TypeBotLog {
  id: string
  phone: string
  session_id: string
  direction: string
  content: string
  message_type: string
  error_message?: string
  created_at: string
}

export default function TypeBotPage() {
  const { user, token } = useAuth()
  const tenantId = user?.tenant_id || ""
  
  const { data: flows, isLoading: flowsLoading } = useApi<TypeBotFlow[]>(
    tenantId ? `/api/proxy/api/typebot/flows/${tenantId}` : null
  )
  
  const { data: logs, isLoading: logsLoading } = useApi<TypeBotLog[]>(
    tenantId ? `/api/proxy/api/typebot/logs/${tenantId}?limit=50` : null
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState<TypeBotFlow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const [newFlow, setNewFlow] = useState({
    name: "",
    flowUrl: "",
    token: "",
  })

  const [flowConfig, setFlowConfig] = useState({
    preferReupload: true,
    enableUrlRewrite: false,
    urlRewriteMap: {},
    delays: {
      fixed: 1000,
      perMessage: 500,
      random: { min: 0, max: 0 },
    },
  })

  const [testData, setTestData] = useState({
    phone: "",
    message: "",
  })

  const handleCreateFlow = async () => {
    if (!newFlow.name || !newFlow.flowUrl) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    try {
      await apiPost(
        `/api/proxy/api/typebot/flows/${tenantId}`,
        {
          name: newFlow.name,
          flowUrl: newFlow.flowUrl,
          token: newFlow.token || undefined,
          settings: flowConfig,
        },
        token
      )
      
      mutate([`/api/proxy/api/typebot/flows/${tenantId}`, token])
      setDialogOpen(false)
      setNewFlow({ name: "", flowUrl: "", token: "" })
      toast.success("TypeBot flow created successfully")
    } catch (error) {
      console.error("Error creating flow:", error)
      toast.error("Failed to create flow")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateConfig = async () => {
    if (!selectedFlow) return

    setIsSubmitting(true)
    try {
      await apiPut(
        `/api/proxy/api/typebot/flows/${tenantId}/${selectedFlow.id}`,
        {
          settings: flowConfig,
        },
        token
      )
      
      mutate([`/api/proxy/api/typebot/flows/${tenantId}`, token])
      setConfigDialogOpen(false)
      toast.success("Configuration updated successfully")
    } catch (error) {
      console.error("Error updating config:", error)
      toast.error("Failed to update configuration")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleFlow = async (flow: TypeBotFlow) => {
    setIsSubmitting(true)
    try {
      await apiPut(
        `/api/proxy/api/typebot/flows/${tenantId}/${flow.id}`,
        {
          isActive: !flow.is_active,
        },
        token
      )
      
      mutate([`/api/proxy/api/typebot/flows/${tenantId}`, token])
      toast.success(`Flow ${flow.is_active ? "deactivated" : "activated"}`)
    } catch (error) {
      console.error("Error toggling flow:", error)
      toast.error("Failed to toggle flow")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this flow?")) return

    setIsSubmitting(true)
    try {
      await apiDelete(`/api/proxy/api/typebot/flows/${tenantId}/${flowId}`, token)
      mutate([`/api/proxy/api/typebot/flows/${tenantId}`, token])
      toast.success("Flow deleted successfully")
    } catch (error) {
      console.error("Error deleting flow:", error)
      toast.error("Failed to delete flow")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestFlow = async () => {
    if (!testData.phone || !testData.message) {
      toast.error("Please fill in phone and message")
      return
    }

    setIsTesting(true)
    try {
      const response = await apiPost(
        `/api/proxy/api/typebot/test/${tenantId}`,
        testData,
        token
      )
      
      toast.success(`Test successful! Received ${response.data.messageCount} messages`)
      setTestDialogOpen(false)
      mutate([`/api/proxy/api/typebot/logs/${tenantId}?limit=50`, token])
    } catch (error) {
      console.error("Error testing flow:", error)
      toast.error("Test failed")
    } finally {
      setIsTesting(false)
    }
  }

  const openConfigDialog = (flow: TypeBotFlow) => {
    setSelectedFlow(flow)
    setFlowConfig(flow.settings || {
      preferReupload: true,
      enableUrlRewrite: false,
      urlRewriteMap: {},
      delays: {
        fixed: 1000,
        perMessage: 500,
        random: { min: 0, max: 0 },
      },
    })
    setConfigDialogOpen(true)
  }

  return (
    <div className="flex flex-col">
      <Header 
        title="TypeBot Integration" 
        description="Manage TypeBot flows and bridge settings"
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue="flows" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="flows">Flows</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Flows Tab */}
          <TabsContent value="flows" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">TypeBot Flows</h2>
                <p className="text-sm text-muted-foreground">
                  Configure your TypeBot integrations
                </p>
              </div>
              <div className="flex gap-2">
                <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <TestTube className="mr-2 h-4 w-4" />
                      Test Flow
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Test TypeBot Flow</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          placeholder="+5511999999999"
                          value={testData.phone}
                          onChange={(e) => setTestData({ ...testData, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Test Message</Label>
                        <Input
                          placeholder="Hello"
                          value={testData.message}
                          onChange={(e) => setTestData({ ...testData, message: e.target.value })}
                        />
                      </div>
                      <Button 
                        onClick={handleTestFlow} 
                        disabled={isTesting}
                        className="w-full"
                      >
                        {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Test
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Flow
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create TypeBot Flow</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Flow Name</Label>
                        <Input
                          placeholder="My TypeBot Flow"
                          value={newFlow.name}
                          onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>TypeBot Public URL</Label>
                        <Input
                          placeholder="https://bot.promolinxy.online/chatbot"
                          value={newFlow.flowUrl}
                          onChange={(e) => setNewFlow({ ...newFlow, flowUrl: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Authentication Token (Optional)</Label>
                        <Input
                          type="password"
                          placeholder="dFFZwBGJE2gQuXLcnVyXYpfj"
                          value={newFlow.token}
                          onChange={(e) => setNewFlow({ ...newFlow, token: e.target.value })}
                        />
                      </div>
                      <Button 
                        onClick={handleCreateFlow} 
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Flow
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {flowsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : flows && flows.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {flows.map((flow) => (
                  <Card key={flow.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <Bot className="h-5 w-5 text-primary" />
                        <Badge variant={flow.is_active ? "default" : "secondary"}>
                          {flow.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <CardTitle className="mt-2">{flow.name}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        {flow.flow_url}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={flow.is_active}
                          onCheckedChange={() => handleToggleFlow(flow)}
                          disabled={isSubmitting}
                        />
                        <Label className="text-sm">
                          {flow.is_active ? "Enabled" : "Disabled"}
                        </Label>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(flow.flow_url, "_blank")}
                          className="flex-1"
                        >
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openConfigDialog(flow)}
                          className="flex-1"
                        >
                          <Settings className="mr-2 h-3 w-3" />
                          Config
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFlow(flow.id)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No TypeBot flows yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first TypeBot integration to get started
                  </p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Flow
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Message Logs</h2>
              <p className="text-sm text-muted-foreground">
                View TypeBot message history
              </p>
            </div>

            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={log.direction === "inbound" ? "default" : "secondary"}>
                              {log.direction}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{log.phone}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{log.content}</p>
                          {log.error_message && (
                            <p className="text-sm text-destructive mt-2">
                              Error: {log.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No logs yet</p>
                  <p className="text-sm text-muted-foreground">
                    Logs will appear here once you start using TypeBot
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Configuration Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure Flow Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Prefer Media Reupload</Label>
                  <Switch
                    checked={flowConfig.preferReupload}
                    onCheckedChange={(checked) =>
                      setFlowConfig({ ...flowConfig, preferReupload: checked })
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Download and reupload media for better reliability
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Enable URL Rewrite</Label>
                  <Switch
                    checked={flowConfig.enableUrlRewrite}
                    onCheckedChange={(checked) =>
                      setFlowConfig({ ...flowConfig, enableUrlRewrite: checked })
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Rewrite URLs in messages (advanced)
                </p>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium">Delays (milliseconds)</h3>
                
                <div className="space-y-2">
                  <Label>Fixed Delay</Label>
                  <Input
                    type="number"
                    value={flowConfig.delays?.fixed || 0}
                    onChange={(e) =>
                      setFlowConfig({
                        ...flowConfig,
                        delays: {
                          ...flowConfig.delays,
                          fixed: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Per-Message Delay</Label>
                  <Input
                    type="number"
                    value={flowConfig.delays?.perMessage || 0}
                    onChange={(e) =>
                      setFlowConfig({
                        ...flowConfig,
                        delays: {
                          ...flowConfig.delays,
                          perMessage: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Random Min</Label>
                    <Input
                      type="number"
                      value={flowConfig.delays?.random?.min || 0}
                      onChange={(e) =>
                        setFlowConfig({
                          ...flowConfig,
                          delays: {
                            ...flowConfig.delays,
                            random: {
                              ...flowConfig.delays?.random,
                              min: parseInt(e.target.value) || 0,
                              max: flowConfig.delays?.random?.max || 0,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Random Max</Label>
                    <Input
                      type="number"
                      value={flowConfig.delays?.random?.max || 0}
                      onChange={(e) =>
                        setFlowConfig({
                          ...flowConfig,
                          delays: {
                            ...flowConfig.delays,
                            random: {
                              min: flowConfig.delays?.random?.min || 0,
                              max: parseInt(e.target.value) || 0,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleUpdateConfig} 
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
