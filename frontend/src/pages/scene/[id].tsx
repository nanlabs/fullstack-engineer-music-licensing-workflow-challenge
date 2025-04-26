"use client";

import { useParams, useRouter } from "next/navigation";
import { useTracks } from "@/hooks/useTracks";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Chip,
  Box,
  Button,
} from "@mui/material";

const statusOptions = [
  "PENDING",
  "NEGOTIATION",
  "APPROVED",
  "REJECTED",
] as const;

const getStatusMuiColor = (
  status: string
): "success" | "error" | "warning" | "primary" => {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "error";
    case "NEGOTIATION":
      return "warning";
    default:
      return "primary";
  }
};

const getColorHex = (muiColor: string) => {
  switch (muiColor) {
    case "success":
      return "#2e7d32";
    case "error":
      return "#d32f2f";
    case "warning":
      return "#ed6c02";
    default:
      return "#1976d2";
  }
};

export default function SceneTracksPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tracks, loading, setTracks } = useTracks(id);

  const handleStatusChange = async (
    licenseStatusId: number,
    newStatus: string
  ) => {
    try {
      const res = await fetch(
        `http://localhost:3000/license-status/${licenseStatusId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error("Error to update status");

      const updated = await res.json();

      setTracks((prev) =>
        prev.map((track) =>
          track.licenseStatus.id === licenseStatusId
            ? { ...track, licenseStatus: updated }
            : track
        )
      );
    } catch (error) {
      console.error(error);
      alert("Cannot change status");
    }
  };

  return (
    <Container maxWidth="lg" sx={{ paddingY: 6 }}>
      <Typography
        variant="h4"
        fontWeight="bold"
        color="primary"
        gutterBottom
        textAlign="center"
      >
        🎵 Tracks of the scene {id}
      </Typography>

      <Button
        variant="contained"
        color="secondary"
        onClick={() => router.back()}
        sx={{ mt: 2, mb: 4, fontSize: "1.1rem" }}
      >
        ⬅ Back
      </Button>

      {loading ? (
        <Typography textAlign="center">Loading ...</Typography>
      ) : (
        <Grid container spacing={8}>
          {tracks.map((track) => {
            const muiColor = getStatusMuiColor(track.licenseStatus.status);
            const colorHex = getColorHex(muiColor);

            return (
              <Grid item key={track.id} xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: 2,
                    borderRadius: 3,
                    boxShadow: 5,
                    backgroundColor: "#F0F4FF",
                  }}
                >
                  <CardContent>
                    <Typography variant="h5" fontWeight="bold">
                      🎧 {track.song.title} - {track.song.artist}
                    </Typography>

                    <Typography variant="h6" mt={1}>
                      <strong>Start:</strong> {track.startTime}
                    </Typography>
                    <Typography variant="h6">
                      <strong>End:</strong> {track.endTime}
                    </Typography>

                    <Box mt={2}>
                      <Typography variant="h6" fontWeight="bold">
                        Current status:
                      </Typography>
                      <Chip
                        label={track.licenseStatus.status}
                        color={muiColor}
                        variant="outlined"
                        sx={{ mt: 1, fontSize: "1rem" }}
                      />
                    </Box>

                    <FormControl fullWidth sx={{ mt: 2 }}>
                      <InputLabel
                        id={`status-label-${track.id}`}
                        sx={{
                          color: colorHex,
                          fontSize: "1rem",
                          fontWeight: "bold",
                          "&.Mui-focused": {
                            color: colorHex,
                          },
                        }}
                      >
                        Change status
                      </InputLabel>
                      <Select
                        labelId={`status-label-${track.id}`}
                        label="Change status"
                        value={track.licenseStatus.status}
                        onChange={(e) =>
                          handleStatusChange(
                            track.licenseStatus.id,
                            e.target.value
                          )
                        }
                        sx={{
                          fontSize: "1rem",
                          backgroundColor: "white",
                          ".MuiOutlinedInput-notchedOutline": {
                            borderColor: colorHex,
                          },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: colorHex,
                          },
                        }}
                      >
                        {statusOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
}
