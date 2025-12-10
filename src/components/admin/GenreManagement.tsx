import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, Tag, Loader2 } from "lucide-react";

interface Genre {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export const GenreManagement = () => {
  const queryClient = useQueryClient();
  const [newGenre, setNewGenre] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: genres = [], isLoading } = useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genres")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Genre[];
    },
  });

  const createGenre = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { error } = await supabase.from("genres").insert({ name, slug });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genres"] });
      setNewGenre("");
      toast.success("Genre added");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Genre already exists");
      } else {
        toast.error("Failed to add genre");
      }
    },
  });

  const updateGenre = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { error } = await supabase.from("genres").update({ name, slug }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genres"] });
      setEditingId(null);
      toast.success("Genre updated");
    },
    onError: () => toast.error("Failed to update genre"),
  });

  const deleteGenre = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("genres").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genres"] });
      toast.success("Genre deleted");
    },
    onError: () => toast.error("Failed to delete genre"),
  });

  const handleAdd = () => {
    if (!newGenre.trim()) {
      toast.error("Please enter a genre name");
      return;
    }
    createGenre.mutate(newGenre.trim());
  };

  const handleEdit = (genre: Genre) => {
    setEditingId(genre.id);
    setEditingName(genre.name);
  };

  const handleSave = () => {
    if (!editingName.trim() || !editingId) return;
    updateGenre.mutate({ id: editingId, name: editingName.trim() });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"?`)) {
      deleteGenre.mutate(id);
    }
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-brand" />
          Genre Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new genre */}
        <div className="flex gap-2">
          <Input
            placeholder="New genre name..."
            value={newGenre}
            onChange={(e) => setNewGenre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={createGenre.isPending}>
            {createGenre.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {/* Genres table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {genres.map((genre) => (
                <TableRow key={genre.id}>
                  <TableCell>
                    {editingId === genre.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                    ) : (
                      genre.name
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{genre.slug}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingId === genre.id ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={handleSave}>
                            <Save className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(genre)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(genre.id, genre.name)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
